import { AppModels } from "../interfaces/models";
import { AuthenticatedUser } from "../interfaces";
import { UserRole } from "../utils/types";
import { Profile } from "./profiles";
import { forbidden } from "./scope";

export interface GuardContext {
  models: AppModels;
  user: AuthenticatedUser;
  profile: Profile;
  args: Record<string, any>;
}

const MANAGEMENT = [Profile.ADMIN, Profile.GERENTE, Profile.SUPERVISOR];
const isAdmin = (ctx: GuardContext) => ctx.user.role === UserRole.ADMIN;

// H-002: un gerente solo gestiona empleados (rol EMPLOYEE) de su estación; nunca crea ni edita
// admins ni gerentes, ni cambia el rol a uno de ellos.
function assertManagerCanTouchUser(ctx: GuardContext, target: { role: string; gasStationId: string | null }) {
  if (isAdmin(ctx)) return;
  if (target.role !== UserRole.EMPLOYEE) throw forbidden("El gerente solo gestiona empleados.");
  if (target.gasStationId !== ctx.user.gasStationId) throw forbidden();
}

function assertManagerCanAssignRole(ctx: GuardContext, input: Record<string, any>) {
  if (isAdmin(ctx) || input.role === undefined) return;
  if (input.role !== UserRole.EMPLOYEE) throw forbidden("El gerente solo puede asignar el rol EMPLOYEE.");
}

async function assertUserTarget(ctx: GuardContext, id: string) {
  const target: any = await ctx.models.User.findByPk(id, { raw: true });
  if (target) assertManagerCanTouchUser(ctx, target);
}

const GUARDS: Record<string, (ctx: GuardContext) => Promise<void>> = {
  "Mutation.createUser": async (ctx) => {
    assertManagerCanAssignRole(ctx, ctx.args.input);
    if (!isAdmin(ctx) && !ctx.args.input.gasStationId) throw forbidden("El gerente debe asignar una estación.");
  },
  "Mutation.createEmployeeWithUser": async (ctx) => {
    assertManagerCanAssignRole(ctx, ctx.args.input);
    if (!isAdmin(ctx) && !ctx.args.input.gasStationId) throw forbidden("El gerente debe asignar una estación.");
  },
  "Mutation.updateUser": async (ctx) => {
    await assertUserTarget(ctx, ctx.args.id);
    assertManagerCanAssignRole(ctx, ctx.args.input);
  },
  "Mutation.deleteUser": async (ctx) => {
    await assertUserTarget(ctx, ctx.args.id);
  },
  // Cajero y bombero abren y cierran solo su propio turno (filas 6 y 7).
  "Mutation.createEmployeeShift": async (ctx) => {
    if (MANAGEMENT.includes(ctx.profile)) return;
    if (!ctx.user.employeeId || ctx.args.input.employeeId !== ctx.user.employeeId) {
      throw forbidden("Solo puedes abrir tu propio turno.");
    }
  },
  "Mutation.endEmployeeShift": async (ctx) => {
    if (MANAGEMENT.includes(ctx.profile)) return;
    const shift: any = await ctx.models.EmployeeShift.findByPk(ctx.args.id, { raw: true });
    if (!shift || !ctx.user.employeeId || shift.employeeId !== ctx.user.employeeId) {
      throw forbidden("Solo puedes cerrar tu propio turno.");
    }
  },
  // Cajero y bombero consultan el detalle de auditoría solo de su turno (fila 18).
  "Query.shiftAuditDetail": async (ctx) => {
    if (MANAGEMENT.includes(ctx.profile) || ctx.profile === Profile.ADMINISTRATIVO) return;
    const shift: any = await ctx.models.EmployeeShift.findByPk(ctx.args.shiftId, { raw: true });
    if (!shift || !ctx.user.employeeId || shift.employeeId !== ctx.user.employeeId) {
      throw forbidden("Solo puedes ver la auditoría de tu propio turno.");
    }
  },
};

export async function guardOperation(key: string, ctx: GuardContext): Promise<void> {
  const guard = GUARDS[key];
  if (guard) await guard(ctx);
}

// Bombero (fila 19: "👁 el suyo"): solo sus filas en los reportes por bombero.
export function filterOwnDispatcherRows(key: string, profile: Profile, employeeId: string | null, result: unknown): unknown {
  if (profile !== Profile.BOMBERO || !Array.isArray(result)) return result;
  if (key === "Query.dispatcherAudit") {
    return result.filter((row: any) => employeeId && row.employee?.id === employeeId);
  }
  if (key === "Query.dispatcherDifferentialSummary") {
    return result.filter((row: any) => employeeId && row.dispatcherEmployeeId === employeeId);
  }
  return result;
}
