import crypto from "crypto";
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
import { Transaction } from "sequelize";
import config from "../config";
import { Context } from "../interfaces";
import { User } from "../models/user";

// Sesión ADR-014: access token JWT corto + refresh token opaco rotativo.
// Una AuthSession es la familia; cada RefreshToken emitido es un eslabón. El tope absoluto
// (expiresAt) se fija en el login y no se extiende al renovar.

export type SessionErrorCode =
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSED"
  | "SESSION_REVOKED"
  | "SESSION_EXPIRED";

const MESSAGES: Record<SessionErrorCode, string> = {
  INVALID_REFRESH_TOKEN: "Refresh token inválido.",
  REFRESH_TOKEN_REUSED: "Refresh token ya utilizado: la sesión fue revocada por seguridad.",
  SESSION_REVOKED: "La sesión fue cerrada. Inicia sesión otra vez.",
  SESSION_EXPIRED: "La sesión superó su duración máxima. Inicia sesión otra vez.",
};

function sessionError(code: SessionErrorCode): GraphQLError {
  return new GraphQLError(MESSAGES[code], { extensions: { code } });
}

export interface AuthPayload {
  token: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  sessionExpiresAt: Date;
  user: User;
}

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

function signAccessToken(user: User, sessionId: string, sessionExpiresAt: Date) {
  const expiresAt = new Date(
    Math.min(Date.now() + config.accessTokenMinutes * 60_000, sessionExpiresAt.getTime())
  );
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, sid: sessionId },
    config.jwtSecret,
    {
      expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      jwtid: crypto.randomUUID(),
    }
  );
  return { token, expiresAt };
}

async function issueRefreshToken(ctx: Context, sessionId: string, t: Transaction) {
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const row = await ctx.models.RefreshToken.create(
    { sessionId, tokenHash: hashToken(refreshToken) },
    { transaction: t }
  );
  return { refreshToken, row };
}

export async function startSession(ctx: Context, user: User): Promise<AuthPayload> {
  return ctx.sequelize.transaction(async (t) => {
    const session = await ctx.models.AuthSession.create(
      { userId: user.id, expiresAt: new Date(Date.now() + config.sessionMaxHours * 3_600_000) },
      { transaction: t }
    );
    const { refreshToken } = await issueRefreshToken(ctx, session.id, t);
    const access = signAccessToken(user, session.id, session.expiresAt);
    return {
      token: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      sessionExpiresAt: session.expiresAt,
      user,
    };
  });
}

export async function rotateSession(ctx: Context, refreshToken: string): Promise<AuthPayload> {
  // La revocación por reuso debe quedar commiteada aunque la respuesta sea un error,
  // por eso el error se lanza fuera de la transacción.
  const outcome = await ctx.sequelize.transaction(
    async (t): Promise<AuthPayload | SessionErrorCode> => {
      const current = await ctx.models.RefreshToken.findOne({
        where: { tokenHash: hashToken(refreshToken) },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!current) return "INVALID_REFRESH_TOKEN";

      const session = await ctx.models.AuthSession.findByPk(current.sessionId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!session) return "INVALID_REFRESH_TOKEN";
      if (session.revokedAt) return "SESSION_REVOKED";
      if (session.expiresAt.getTime() <= Date.now()) return "SESSION_EXPIRED";

      if (current.replacedById) {
        await session.update(
          { revokedAt: new Date(), revokedReason: "REUSE_DETECTED" },
          { transaction: t }
        );
        return "REFRESH_TOKEN_REUSED";
      }

      const user = await ctx.models.User.findByPk(session.userId, { transaction: t });
      if (!user) return "INVALID_REFRESH_TOKEN";

      const next = await issueRefreshToken(ctx, session.id, t);
      await current.update(
        { replacedById: next.row.id, rotatedAt: new Date() },
        { transaction: t }
      );
      const access = signAccessToken(user, session.id, session.expiresAt);
      return {
        token: access.token,
        accessTokenExpiresAt: access.expiresAt,
        refreshToken: next.refreshToken,
        sessionExpiresAt: session.expiresAt,
        user,
      };
    }
  );

  if (typeof outcome === "string") throw sessionError(outcome);
  return outcome;
}

// Acepta cualquier refresh de la familia (vigente o ya rotado). false si el token no existe.
export async function endSession(ctx: Context, refreshToken: string): Promise<boolean> {
  const current = await ctx.models.RefreshToken.findOne({
    where: { tokenHash: hashToken(refreshToken) },
  });
  if (!current) return false;
  await ctx.models.AuthSession.update(
    { revokedAt: new Date(), revokedReason: "LOGOUT" },
    { where: { id: current.sessionId, revokedAt: null } }
  );
  return true;
}
