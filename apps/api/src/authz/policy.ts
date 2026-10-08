import { Profile } from "./profiles";

// Mapa declarativo operación → perfiles permitidos (ADR-016, matriz de permisos).
// Fila de la matriz entre paréntesis. Las operaciones que no aparecen aquí solo las puede
// ejecutar ADMIN (regla por defecto en index.ts). Los controles que dependen del dato
// (propio turno, empleado de su estación, rol asignable) están en guards.ts.

const { ADMIN: A, GERENTE: G, SUPERVISOR: S, CAJERO: C, BOMBERO: B, ADMINISTRATIVO: D } = Profile;
const ALL = [A, G, S, C, B, D];

export interface OpPolicy {
  profiles: Profile[];
  public?: boolean; // no exige token (login, refreshSession, logout; createUser solo sin usuarios)
  entity?: string; // modelo del argumento id, si no se deduce del nombre de la operación
}

const grant = (
  kind: "Query" | "Mutation",
  names: string[],
  profiles: Profile[],
  extra: Partial<OpPolicy> = {}
): Record<string, OpPolicy> =>
  Object.fromEntries(names.map((n) => [`${kind}.${n}`, { profiles, ...extra }]));

export const PUBLIC_OPERATIONS = new Set(["Mutation.login", "Mutation.refreshSession", "Mutation.logout"]);

export const POLICY: Record<string, OpPolicy> = {
  // Sesión
  ...grant("Query", ["me"], ALL),
  ...grant("Query", ["licenseStatus"], ALL),
  ...grant("Mutation", ["login", "refreshSession", "logout"], [], { public: true }),
  // Usuarios (fila 1: el gerente solo gestiona empleados de su estación; ver guards.ts)
  ...grant("Query", ["users", "user"], [A, G]),
  ...grant("Mutation", ["createUser", "updateUser", "deleteUser"], [A, G]),
  ...grant("Mutation", ["createEmployeeWithUser", "createEmployee", "updateEmployee", "deleteEmployee"], [A, G]),
  ...grant("Query", ["employees", "employee"], ALL),

  // Empresa (fuera de la matriz: solo ADMIN, alcance de empresa)
  ...grant("Query", ["companies", "company"], [A]),
  ...grant("Mutation", ["createCompany", "updateCompany", "deleteCompany"], [A]),

  // Catálogos (fila 3, 4 y 5)
  ...grant("Query", ["fuelTypes", "fuelType", "currencies", "currency", "tankModels", "tankModel", "tankCalibrationEntries", "tankCalibrationEntry", "tankCalibrationEntriesByModel", "tankCalibrationEntryByModelAndHeight", "saleTypeConfigs", "saleTypeConfig", "saleTypeConfigByStationFuelTypeAndName"], ALL),
  ...grant("Mutation", ["createFuelType", "updateFuelType", "deleteFuelType", "createCurrency", "deleteCurrency"], [A]),
  ...grant("Mutation", ["updateCurrency"], [A, G, D]), // fila 4: tasa de cambio (el campo no se separa)
  ...grant("Mutation", ["createTankModel", "updateTankModel", "deleteTankModel", "createTankCalibrationEntry", "updateTankCalibrationEntry", "deleteTankCalibrationEntry", "bulkCreateTankCalibrationEntries"], [A]),
  ...grant("Mutation", ["createSaleTypeConfig", "updateSaleTypeConfig", "deleteSaleTypeConfig"], [A, G]), // fila 5

  // Equipamiento (fila 2: lectura para todo el personal de la estación, escritura solo admin)
  ...grant("Query", ["gasStations", "gasStation"], ALL),
  ...grant("Mutation", ["createGasStation", "updateGasStation", "deleteGasStation"], [A]),
  // "deactivate" no está en el prefijo de verbos que recorta entityFromOperation
  // (create/update/delete/...), así que el modelo del argumento id se declara explícito.
  // Reactivar no tiene mutation: solo CCI Innovation puede, con el script reactivate-station.
  ...grant("Mutation", ["deactivateGasStation"], [A], { entity: "GasStation" }),
  ...grant("Query", ["pumpIslands", "pumpIsland", "pumpIslandsByGasStation", "pumpIslandByGasStationAndName", "dispensers", "dispenser", "dispensersByGasStation", "dispensersByPumpIsland", "dispensersByTank", "dispensersByFuelType", "dispenserByGasStationAndName", "dispenserNozzles", "dispenserNozzle", "dispenserNozzlesByDispenser", "dispenserNozzleByDispenserAndName", "tanks", "tank", "tanksByGasStation", "tankByGasStationAndName", "tankAssignments", "tankAssignment", "tankAssignmentsByDispatchReception", "tankAssignmentByDispatchReceptionAndDate"], ALL),
  ...grant("Mutation", ["createPumpIsland", "updatePumpIsland", "deletePumpIsland", "createDispenser", "updateDispenser", "deleteDispenser", "createDispenserNozzle", "updateDispenserNozzle", "deleteDispenserNozzle", "createTank", "updateTank", "deleteTank", "createTankAssignment", "updateTankAssignment", "deleteTankAssignment"], [A]),

  // Mediciones de tanque (fila 14)
  ...grant("Query", ["tankMeasurements", "tankMeasurement", "tankMeasurementsByTank", "tankMeasurementsByEmployee", "latestTankMeasurement"], ALL),
  ...grant("Mutation", ["createTankMeasurement", "updateTankMeasurement", "deleteTankMeasurement"], [A, G, S, B]),

  // Lecturas de boquilla (fila 8)
  ...grant("Query", ["dispenserReadings", "dispenserReading", "dispenserReadingsByNozzle", "dispenserReadingsByShift", "dispenserReadingByNozzleShiftAndType"], ALL),
  ...grant("Mutation", ["createDispenserReading", "updateDispenserReading", "deleteDispenserReading"], [A, G, S, C]),

  // Turnos (filas 6 y 7; el cajero/bombero solo su propio turno: guards.ts)
  ...grant("Query", ["employeeShifts", "employeeShift", "employeeShiftsByEmployee", "employeeShiftsByGasStation", "activeEmployeeShift"], ALL),
  ...grant("Mutation", ["createEmployeeShift", "endEmployeeShift"], [A, G, S, C, B]),
  ...grant("Mutation", ["updateEmployeeShift", "deleteEmployeeShift"], [A, G, S]),

  // Tickets de venta (filas 9 a 13)
  ...grant("Query", ["salesTickets", "salesTicket", "salesTicketsByGasStation", "salesTicketsByCashierShift", "salesTicketsByDispatcher", "salesTicketsByNozzle", "salesTicketsByFuelType", "salesTicketsByStatus", "salesTicketDailyTotals", "salesTicketDifferential"], ALL, { entity: "SalesTicket" }),
  ...grant("Query", ["dispatcherDifferentialSummary"], [A, G, S, D, B]), // fila 19; el bombero solo ve el suyo (guards.ts)
  ...grant("Mutation", ["createSalesTicket", "updateSalesTicket", "completeSalesTicketPayment"], [A, G, S, C]),
  ...grant("Mutation", ["deleteSalesTicket"], [A]),
  ...grant("Mutation", ["processSalesTicketDispatch"], [A, G, S, C, B], { entity: "SalesTicket" }),
  ...grant("Mutation", ["cancelSalesTicket"], [A, G, S]),
  ...grant("Query", ["ticketRefundsBySalesTicket"], [A, G, S, C]),
  ...grant("Mutation", ["createTicketRefund"], [A, G, S, C]),

  // Cobros (fila 10)
  ...grant("Query", ["payments", "payment", "paymentsBySalesTicket", "paymentsByMethod", "paymentsByCurrency"], ALL),
  ...grant("Mutation", ["createPayment", "createPayments", "updatePayment", "deletePayment"], [A, G, S, C]),

  // Compras a proveedor (filas 15 a 17)
  ...grant("Query", ["invoices", "invoice"], [A, G, S, D]),
  ...grant("Mutation", ["createInvoice", "updateInvoice", "deleteInvoice", "closeInvoice"], [A, G, D]),
  ...grant("Query", ["dispatchReceptions", "dispatchReception", "dispatchReceptionsByTank", "dispatchReceptionByInvoiceAndTank"], [A, G, S, D]),
  ...grant("Mutation", ["createDispatchReception", "updateDispatchReception", "deleteDispatchReception"], [A, G, S, D]),
  ...grant("Query", ["invoicePayment", "invoicePayments", "invoiceBalance", "invoicePaymentsByStation", "unpaidInvoices"], [A, G, D]),
  ...grant("Query", ["invoiceProfitMargin"], [A, G, S, D]),
  ...grant("Mutation", ["createInvoicePayment", "updateInvoicePayment", "deleteInvoicePayment"], [A, D]),

  // Reportes y auditorías (fila 18 y 19)
  ...grant("Query", ["invoiceAudit", "driverAuditSummary", "shiftAudit", "shiftFinancialAudit", "tankBalanceAudit", "tankBalanceAuditByStation"], [A, G, S, D]),
  ...grant("Query", ["shiftAuditDetail"], [A, G, S, D, C, B]), // cajero y bombero: solo su turno (guards.ts)
  ...grant("Query", ["dispatcherAudit"], [A, G, S, D, B]), // fila 19; el bombero solo ve sus filas
  ...grant("Query", ["auditPeriodCloses", "auditPeriodClose"], [A, G, S, D]),
  ...grant("Mutation", ["createAuditPeriodClose", "confirmAuditPeriodClose", "recalculateAuditPeriodClose"], [A, G, D]), // fila 20
  ...grant("Mutation", ["deleteAuditPeriodClose"], [A]),
};

export function policyFor(key: string): OpPolicy | undefined {
  return POLICY[key];
}
