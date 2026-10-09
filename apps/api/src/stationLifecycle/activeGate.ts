import { GraphQLError } from "graphql";
import { AppModels } from "../interfaces/models";
import { getAuthorizedStationIds } from "../license/service";

// D-19 (propuesta provisional de ft-core, todavía abierta con José — ver fueltrack-vault,
// 80-dudas/Dudas para Jose.md): el día a día de una estación desactivada se bloquea; sus reportes
// e histórico siguen visibles (esto solo se aplica a mutations, nunca a queries), y se puede
// reasignar un usuario a otra estación (updateUser no está en esta lista).
//
// Cada categoría queda aislada a propósito, para poder ajustarla sin tocar ningún resolver:
// agregar o quitar nombres de operación aquí es el único cambio necesario.
const SHIFT_OPS = ["createEmployeeShift", "updateEmployeeShift", "endEmployeeShift", "deleteEmployeeShift"];
const TICKET_OPS = [
  "createSalesTicket", "updateSalesTicket", "processSalesTicketDispatch",
  "completeSalesTicketPayment", "cancelSalesTicket", "deleteSalesTicket",
  "createPayment", "createPayments", "updatePayment", "deletePayment",
  "createTicketRefund",
];
const READING_OPS = ["createDispenserReading", "updateDispenserReading", "deleteDispenserReading"];
const MEASUREMENT_OPS = ["createTankMeasurement", "updateTankMeasurement", "deleteTankMeasurement"];

export const STATION_ACTIVE_REQUIRED_OPS = new Set([
  ...SHIFT_OPS,
  ...TICKET_OPS,
  ...READING_OPS,
  ...MEASUREMENT_OPS,
]);

export function stationInactiveError(): GraphQLError {
  return new GraphQLError("La estación está desactivada.", { extensions: { code: "STATION_INACTIVE" } });
}

export function stationNotLicensedError(): GraphQLError {
  return new GraphQLError(
    "Esta estación no está habilitada en la licencia. Contacta a Core Code Innovation.",
    { extensions: { code: "STATION_NOT_LICENSED" } }
  );
}

// `stationIds` ya las resolvió la autorización (assertReferencesInScope): no se repiten consultas
// para encontrar a qué estación pertenece cada referencia, solo se revisa si alguna está inactiva.
export async function assertStationsActive(
  models: AppModels,
  field: string,
  stationIds: Set<string>
): Promise<void> {
  if (stationIds.size === 0 || !STATION_ACTIVE_REQUIRED_OPS.has(field)) return;
  const inactive = await models.GasStation.count({ where: { id: [...stationIds], active: false } });
  if (inactive > 0) throw stationInactiveError();
}

// T-058: misma lista de operaciones que D-19 (STATION_ACTIVE_REQUIRED_OPS) — una estación activa
// pero no autorizada por la clave "stations" de la licencia vigente no puede operar. Si
// `authorized` nunca se informó (getAuthorizedStationIds devuelve null), no se bloquea por esto.
export async function assertStationsLicensed(
  models: AppModels,
  field: string,
  stationIds: Set<string>
): Promise<void> {
  if (stationIds.size === 0 || !STATION_ACTIVE_REQUIRED_OPS.has(field)) return;
  const authorized = await getAuthorizedStationIds(models);
  if (!authorized) return;
  for (const id of stationIds) {
    if (!authorized.has(id)) throw stationNotLicensedError();
  }
}
