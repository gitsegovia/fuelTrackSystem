import { GraphQLError, GraphQLFieldResolver, getNamedType, GraphQLResolveInfo } from "graphql";
import { IResolvers } from "@graphql-tools/utils";
import { AppModels } from "../interfaces/models";
import { AuthenticatedUser, Context } from "../interfaces";
import { verifyToken } from "../middleware/auth";
import { UserRole } from "../utils/types";
import { Profile, profileOf } from "./profiles";
import { POLICY, PUBLIC_OPERATIONS, OpPolicy } from "./policy";
import {
  assertReferencesInScope,
  collectReferences,
  entityFromOperation,
  filterResult,
  forbidden,
} from "./scope";
import { filterOwnDispatcherRows, guardOperation } from "./guards";

// Usuario de la request: el token debe tener sesión vigente (no revocada ni vencida) y el usuario
// se vuelve a leer de la BD, así un cambio de rol o de estación aplica sin esperar al token.
export async function loadRequestUser(
  models: AppModels,
  authorization?: string
): Promise<AuthenticatedUser | undefined> {
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const payload = verifyToken(authorization.slice("Bearer ".length));
  if (!payload?.id || !payload.sid) return undefined;

  const session: any = await models.AuthSession.findByPk(payload.sid, { raw: true });
  if (
    !session ||
    session.userId !== payload.id ||
    session.revokedAt ||
    new Date(session.expiresAt) <= new Date()
  ) {
    return undefined;
  }

  const user: any = await models.User.findByPk(payload.id, { raw: true });
  if (!user) return undefined;
  const employee: any = await models.Employee.findOne({
    where: { userId: user.id },
    attributes: ["id"],
    raw: true,
  });

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    userType: user.userType,
    companyId: user.companyId,
    gasStationId: user.gasStationId ?? null,
    employeeId: employee?.id ?? null,
    sid: payload.sid,
  };
}

type AnyResolver = GraphQLFieldResolver<unknown, Context>;

function unauthenticated(): GraphQLError {
  return new GraphQLError("Autenticación requerida.", { extensions: { code: "UNAUTHENTICATED" } });
}

function hasArgument(info: GraphQLResolveInfo, name: string): boolean {
  const field = info.parentType.getFields()[info.fieldName];
  return !!field?.args.some((a) => a.name === name);
}

// Campos de actor (H-014): el valor del cliente se ignora y se toma del token.
function applyActorFields(args: Record<string, any>, user: AuthenticatedUser): Record<string, any> {
  if (!args.input || typeof args.input !== "object") return args;
  const input = { ...args.input };
  if ("recordedById" in input) input.recordedById = user.id;
  if ("closedById" in input) input.closedById = user.id;
  return { ...args, input };
}

function guardField(kind: "Query" | "Mutation", field: string, resolve: AnyResolver): AnyResolver {
  const key = `${kind}.${field}`;
  const policy: OpPolicy | undefined = POLICY[key];

  return async (parent, args, context, info) => {
    if (PUBLIC_OPERATIONS.has(key)) return resolve(parent, args, context, info);

    // Arranque: el primer usuario (admin inicial) se crea sin sesión, como hoy con bootstrap-admin.
    if (key === "Mutation.createUser" && (await context.models.User.count()) === 0) {
      return resolve(parent, args, context, info);
    }

    const user = context.user;
    if (!user) throw unauthenticated();

    // Operaciones fuera del mapa: solo ADMIN (regla por defecto).
    const profile = profileOf(user.role, user.userType as any);
    const allowed = policy?.profiles ?? [Profile.ADMIN];
    if (!profile || !allowed.includes(profile)) throw forbidden();

    let a: Record<string, any> = { ...args };
    // Estación por defecto: un gerente o empleado que no pide estación ve la suya.
    if (user.role !== UserRole.ADMIN && a.gasStationId === undefined && hasArgument(info, "gasStationId")) {
      a.gasStationId = user.gasStationId;
    }
    // Argumento id: el modelo sale de la operación; si no se puede determinar, se rechaza.
    if (a.id !== undefined) {
      const entity = policy?.entity ?? entityFromOperation(field);
      if (!entity) throw forbidden();
      await assertReferencesInScope(context.models, user, [{ model: entity, id: a.id }]);
    }
    await assertReferencesInScope(context.models, user, collectReferences(a));

    await guardOperation(key, { models: context.models, user, profile, args: a });
    a = applyActorFields(a, user);

    const result = await resolve(parent, a, context, info);
    if (kind !== "Query") return result;

    const typeName = getNamedType(info.returnType).name;
    const scoped = await filterResult(context.models, user, typeName, result);
    return filterOwnDispatcherRows(key, profile, user.employeeId, scoped);
  };
}

// Aplicar DESPUÉS de la idempotencia: una operación rechazada no se marca APPLIED.
export function applyAuthorization(resolvers: IResolvers<any>[]): IResolvers<any>[] {
  return resolvers.map((map: any) => {
    const out: any = { ...map };
    for (const kind of ["Query", "Mutation"] as const) {
      if (!map[kind]) continue;
      out[kind] = Object.fromEntries(
        Object.entries(map[kind]).map(([field, fn]) => {
          if (typeof fn !== "function") {
            throw new Error(`Resolver ${kind}.${field} debe ser una función para aplicar autorización.`);
          }
          if (!POLICY[`${kind}.${field}`]) {
            console.warn(`[authz] ${kind}.${field} no está en el mapa de permisos: solo ADMIN.`);
          }
          return [field, guardField(kind, field, fn as AnyResolver)];
        })
      );
    }
    return out;
  });
}
