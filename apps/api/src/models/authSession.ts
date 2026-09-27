import { DataTypes, Model, Optional, Sequelize, ModelStatic } from "sequelize";
import type { AppModels } from "../interfaces/models";

export type SessionRevokedReason = "LOGOUT" | "REUSE_DETECTED";

export interface AuthSessionAttributes {
  id: string;
  userId: string;
  expiresAt: Date; // tope absoluto: login + SESSION_MAX_HOURS, no se extiende al renovar
  revokedAt: Date | null;
  revokedReason: SessionRevokedReason | null;
}

interface AuthSessionCreationAttributes
  extends Optional<AuthSessionAttributes, "id" | "revokedAt" | "revokedReason"> {}

export class AuthSession
  extends Model<AuthSessionAttributes, AuthSessionCreationAttributes>
  implements AuthSessionAttributes
{
  public id!: string;
  public userId!: string;
  public expiresAt!: Date;
  public revokedAt!: Date | null;
  public revokedReason!: SessionRevokedReason | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: AppModels) {
    this.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    this.hasMany(models.RefreshToken, { foreignKey: "sessionId", as: "refreshTokens" });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<AuthSession> {
  AuthSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      revokedReason: { type: DataTypes.STRING(20), allowNull: true },
    },
    {
      sequelize,
      tableName: "auth_sessions",
      modelName: "AuthSession",
      indexes: [{ name: "auth_sessions_user_id", fields: ["userId"] }],
    }
  );
  return AuthSession;
}
