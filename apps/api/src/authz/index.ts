import { GraphQLError, GraphQLFieldResolver, getNamedType, GraphQLResolveInfo } from "graphql";
import { IResolvers } from "@graphql-tools/utils";
import { AppModels } from "../interfaces/models";
import { AuthenticatedUser, Context } from "../interfaces";
import { verifyToken } from "../middleware/auth";
import { UserRole, UserType } from "../utils/types";
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

// Cargo Administrativo: alcance de empresa solo en facturas, pagos a proveedor, reportes y cierres
// (filas 15, 17, 18 y 20 de la matriz). En el resto de operaciones vale el rol EMPLOYEE.
const ADMINISTRATIVO_COMPANY_SCOPE = new Set([
  "Query.invoices", "Query.invoice", "Mutation.createInvoice", "Mutation.updateInvoice",
  "Mutation.deleteInvoice", "Mutation.closeInvoice",
  "Query.invoicePayment", "Query.invoicePayments", "Query.invoiceBalance",
  "Query.invoicePaymentsByStation", "Query.unpaidInvoices", "Query.invoiceProfitMargin",
  "Mutation.createInvoicePayment", "Mutation.updateInvoicePayment", "Mutation.deleteInvoicePayment",
  "Query.invoiceAudit", "Query.driverAuditSummary", "Query.shiftAudit", "Query.shiftAuditDetail",
  "Query.shiftFinancialAudit", "Query.tankBalanceAudit", "Query.tankBalanceAuditByStation",
  "Query.dispatcherAudit", "Query.auditPeriodCloses", "Query.auditPeriodClose",
  "Mutation.createAuditPeriodClose", "Mutation.confirmAuditPeriodClose",
  "Mutation.recalculateAuditPeriodClose",
]);

// Usuario con el que se evalúa el alcance de una operación.
function scopeUserFor(user: AuthenticatedUser, key: string): AuthenticatedUser {
  if (user.role !== UserRole.ADMIN && user.userType === UserType.ADMINISTRATIVE && ADMINISTRATIVO_COMPANY_SCOPE.has(key)) {
    return { ...user, role: UserRole.ADMIN };
  }
  return user;
}

function unauthenticated(): GraphQLError {
  return new GraphQLError("Autenticación requerida.", {
    extensions: { code: "UNAUTHENTICATED", rule: "sin-sesion" },
  });
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

// Una línea por denegación, sin tokens: operación, usuario, regla y origen (cola offline o no).
function logDenial(key: string, info: GraphQLResolveInfo, user: AuthenticatedUser | undefined, context: Context, error: any) {
  const code = error?.extensions?.code;
  if (code !== "FORBIDDEN" && code !== "UNAUTHENTICATED") return;
  const who = user
    ? `user=${user.username} id=${user.id} role=${user.role} userType=${user.userType}`
    : "user=anonimo";
  const origen = context.offlineSource ? "cola-offline" : context.offlineMutationId ? "idempotente" : "directo";
  const operacion = info.operation.name?.value ?? "sin-nombre";
  console.warn(
    `[authz] ${code} op=${key} operacionGraphQL=${operacion} ${who} regla=${error.extensions?.rule ?? "desconocida"} origen=${origen} mensaje="${error.message}"`
  );
}

function guardField(kind: "Query" | "Mutation", field: string, resolve: AnyResolver): AnyResolver {
  const key = `${kind}.${field}`;
  const policy: OpPolicy | undefined = POLICY[key];

  const authorized: AnyResolver = async (parent, args, context, info) => {
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
    if (!profile || !allowed.includes(profile)) {
      throw forbidden(
        "No tienes permiso para esta operación.",
        policy ? "perfil-no-permitido" : "sin-politica-solo-admin"
      );
    }

    const scopeUser = scopeUserFor(user, key);
    let a: Record<string, any> = { ...args };
    // Estación por defecto: un gerente o empleado que no pide estación ve la suya.
    if (scopeUser.role !== UserRole.ADMIN && a.gasStationId === undefined && hasArgument(info, "gasStationId")) {
      a.gasStationId = scopeUser.gasStationId;
    }
    // Argumento id: el modelo sale de la operación; si no se puede determinar, se rechaza.
    if (a.id !== undefined) {
      const entity = policy?.entity ?? entityFromOperation(field);
      if (!entity) throw forbidden("No tienes permiso para esta operación.", "entidad-id-desconocida");
      await assertReferencesInScope(context.models, scopeUser, [{ model: entity, id: a.id }]);
    }
    await assertReferencesInScope(context.models, scopeUser, collectReferences(a));

    try {
      await guardOperation(key, { models: context.models, user, profile, args: a });
    } catch (error: any) {
      if (error?.extensions?.code === "FORBIDDEN" && error.extensions.rule === "desconocida") {
        throw forbidden(error.message, `regla:${key}`);
      }
      throw error;
    }
    a = applyActorFields(a, user);

    const result = await resolve(parent, a, context, info);
    if (kind !== "Query") return result;

    const typeName = getNamedType(info.returnType).name;
    const scoped = await filterResult(context.models, scopeUser, typeName, result);
    return filterOwnDispatcherRows(key, profile, user.employeeId, scoped);
  };

  return async (parent, args, context, info) => {
    try {
      return await authorized(parent, args, context, info);
    } catch (error: any) {
      logDenial(key, info, context.user, context, error);
      throw error;
    }
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
