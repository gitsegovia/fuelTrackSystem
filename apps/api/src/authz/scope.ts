import { GraphQLError } from "graphql";
import { AppModels } from "../interfaces/models";
import { AuthenticatedUser } from "../interfaces";
import { UserRole } from "../utils/types";

// Alcance del token (ADR-016): ADMIN → su empresa; MANAGER/EMPLOYEE → su estación.
// El alcance de cada fila sale de la estación o empresa a la que pertenece; los catálogos sin
// relación con una estación (combustibles, monedas, modelos de tanque) no tienen alcance.

export interface Scope {
  gasStationId?: string | null; // undefined = catálogo sin estación; null = con estación faltante
  companyId?: string | null;
}

export const ENTITY_MODELS = [
  "Company", "GasStation", "User", "Employee", "EmployeeShift", "FuelType", "SaleTypeConfig",
  "Currency", "TankModel", "TankCalibrationEntry", "Tank", "TankAssignment", "DispatchReception",
  "PumpIsland", "Dispenser", "DispenserNozzle", "DispenserReading", "SalesTicket", "Payment",
  "TankMeasurement", "InvoicePayment", "AuditPeriodClose", "Invoice", "TicketRefund",
];

// Tipos de resultado con alcance propio (se filtran las listas y se oculta un objeto fuera de alcance).
const STATION_RESULT_TYPES = new Set([
  "Company", "GasStation", "User", "Employee", "EmployeeShift", "SaleTypeConfig", "Tank",
  "TankAssignment", "DispatchReception", "PumpIsland", "Dispenser", "DispenserNozzle",
  "DispenserReading", "SalesTicket", "Payment", "TankMeasurement", "InvoicePayment",
  "AuditPeriodClose", "Invoice", "TicketRefund",
]);

// Modelos cuyo alcance se obtiene a través de un padre (fk → padre.gasStationId).
const LINKS: Record<string, { fk: string; parent: string }> = {
  DispenserNozzle: { fk: "dispenserId", parent: "Dispenser" },
  DispenserReading: { fk: "shiftId", parent: "EmployeeShift" },
  TankMeasurement: { fk: "tankId", parent: "Tank" },
  TankAssignment: { fk: "tankId", parent: "Tank" },
  DispatchReception: { fk: "invoiceId", parent: "Invoice" },
  InvoicePayment: { fk: "invoiceId", parent: "Invoice" },
  Payment: { fk: "salesTicketId", parent: "SalesTicket" },
  TicketRefund: { fk: "salesTicketId", parent: "SalesTicket" },
};

// Modelos con gasStationId propio.
const DIRECT_STATION = new Set([
  "Employee", "EmployeeShift", "Tank", "PumpIsland", "Dispenser", "SaleTypeConfig", "Invoice",
  "SalesTicket", "AuditPeriodClose", "User",
]);

// Argumentos o campos de input que referencian una fila con alcance.
export const REFERENCE_FIELDS: Record<string, string> = {
  gasStationId: "GasStation",
  companyId: "Company",
  salesTicketId: "SalesTicket",
  cashierShiftId: "EmployeeShift",
  dispatcherShiftId: "EmployeeShift",
  shiftId: "EmployeeShift",
  employeeShiftId: "EmployeeShift",
  employeeId: "Employee",
  dispatcherEmployeeId: "Employee",
  dispenserNozzleId: "DispenserNozzle",
  dispenserId: "Dispenser",
  pumpIslandId: "PumpIsland",
  tankId: "Tank",
  tankAssignmentId: "TankAssignment",
  tankMeasurementId: "TankMeasurement",
  dispenserReadingId: "DispenserReading",
  invoiceId: "Invoice",
  invoicePaymentId: "InvoicePayment",
  dispatchReceptionId: "DispatchReception",
  paymentId: "Payment",
  ticketRefundId: "TicketRefund",
  saleTypeConfigId: "SaleTypeConfig",
  assignedSaleTypeConfigId: "SaleTypeConfig",
  userId: "User",
  auditPeriodCloseId: "AuditPeriodClose",
};

const VERBS = /^(create|update|delete|bulkCreate|confirm|recalculate|process|cancel|complete|close|end)/;

// Modelo del argumento id según el nombre de la operación (ej. updateTank → Tank).
export function entityFromOperation(field: string): string | undefined {
  const rest = field.replace(VERBS, "");
  const name = rest.charAt(0).toUpperCase() + rest.slice(1);
  return ENTITY_MODELS.includes(name) ? name : undefined;
}

// `rule` identifica la regla que negó (solo se escribe en el log del servidor, nunca en la respuesta).
export function forbidden(message = "No tienes permiso para esta operación.", rule = "desconocida"): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN", rule } });
}

export function inScope(user: AuthenticatedUser, scope: Scope): boolean {
  if (scope.companyId !== undefined && scope.companyId !== null && scope.companyId !== user.companyId) {
    return false;
  }
  if (user.role === UserRole.ADMIN) return true;
  if (scope.gasStationId === undefined) return true; // catálogo
  return scope.gasStationId !== null && scope.gasStationId === user.gasStationId;
}

export async function scopesOf(models: AppModels, model: string, rows: any[]): Promise<Scope[]> {
  if (rows.length === 0) return [];
  if (model === "Company") return rows.map((r) => ({ companyId: r.id }));
  if (model === "GasStation") return rows.map((r) => ({ gasStationId: r.id, companyId: r.companyId }));

  let stationIds: (string | null)[];
  const link = LINKS[model];
  if (link) {
    const fks = [...new Set(rows.map((r) => r[link.fk]).filter(Boolean))] as string[];
    const parents: any[] = fks.length
      ? await (models as any)[link.parent].findAll({ where: { id: fks }, attributes: ["id", "gasStationId"], raw: true })
      : [];
    const byId = new Map(parents.map((p) => [p.id, p.gasStationId as string | null]));
    stationIds = rows.map((r) => byId.get(r[link.fk]) ?? null);
  } else if (DIRECT_STATION.has(model)) {
    stationIds = rows.map((r) => (r.gasStationId ?? null) as string | null);
  } else {
    return rows.map(() => ({}));
  }

  const companyOfStation = new Map<string, string | null>();
  const missing = [...new Set(stationIds.filter(Boolean) as string[])].filter(
    (id) => !rows.some((r) => r.companyId && r.gasStationId === id)
  );
  if (missing.length) {
    const stations: any[] = await models.GasStation.findAll({
      where: { id: missing },
      attributes: ["id", "companyId"],
      raw: true,
    });
    for (const s of stations) companyOfStation.set(s.id, s.companyId);
  }

  return rows.map((r, i) => {
    const gasStationId = stationIds[i];
    const companyId = r.companyId ?? (gasStationId ? companyOfStation.get(gasStationId) ?? null : null);
    return { gasStationId, companyId };
  });
}

// Recorre argumentos e inputs y junta las referencias a filas con alcance.
export function collectReferences(value: unknown, out: Array<{ model: string; id: string }> = []) {
  if (Array.isArray(value)) {
    for (const v of value) collectReferences(v, out);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const model = REFERENCE_FIELDS[key];
      if (model && typeof v === "string") out.push({ model, id: v });
      else collectReferences(v, out);
    }
  }
  return out;
}

export async function assertReferencesInScope(
  models: AppModels,
  user: AuthenticatedUser,
  refs: Array<{ model: string; id: string }>
): Promise<void> {
  const byModel = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!byModel.has(r.model)) byModel.set(r.model, new Set());
    byModel.get(r.model)!.add(r.id);
  }
  for (const [model, ids] of byModel) {
    const rows: any[] = await (models as any)[model].findAll({ where: { id: [...ids] }, raw: true });
    const scopes = await scopesOf(models, model, rows);
    if (scopes.some((s) => !inScope(user, s))) {
      throw forbidden("Referencia fuera de tu alcance.", `alcance-referencia:${model}`);
    }
  }
}

// Filtra resultados de tipos con alcance: las listas quitan lo ajeno; un objeto ajeno se devuelve null.
export async function filterResult(
  models: AppModels,
  user: AuthenticatedUser,
  typeName: string,
  result: unknown
): Promise<unknown> {
  if (!STATION_RESULT_TYPES.has(typeName) || result === null || result === undefined) return result;
  if (Array.isArray(result)) {
    const scopes = await scopesOf(models, typeName, result);
    return result.filter((_, i) => inScope(user, scopes[i]));
  }
  const [scope] = await scopesOf(models, typeName, [result]);
  return inScope(user, scope) ? result : null;
}
