import { Op, QueryTypes } from "sequelize";
import { Context } from "../../interfaces";
import { MeasurementReason, SalesTicketStatus, PaymentMethod } from "../../utils/types";

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function buildDateWhere(field: string, startDate?: Date, endDate?: Date) {
  if (startDate && endDate) return { [field]: { [Op.between]: [startDate, endDate] } };
  if (startDate) return { [field]: { [Op.gte]: startDate } };
  if (endDate) return { [field]: { [Op.lte]: endDate } };
  return {};
}

export function toNum(v: any): number {
  return parseFloat(String(v ?? 0)) || 0;
}

export function round(v: number, dec = 4): number {
  return Math.round(v * 10 ** dec) / 10 ** dec;
}

// ─── 1. Auditoría de recepciones ──────────────────────────────────────────────

export async function computeInvoiceAudit(
  gasStationId: string,
  startDate: Date | undefined,
  endDate: Date | undefined,
  ctx: Context
) {
  const dateWhere = buildDateWhere("dispatchDate", startDate, endDate);
  const invoices = await ctx.models.Invoice.findAll({
    where: { gasStationId, ...dateWhere },
    include: [
      { model: ctx.models.GasStation, as: "receivingGasStation" },
      { model: ctx.models.DispatchReception, as: "dispatchReceptions", required: false },
    ],
    order: [["dispatchDate", "DESC"]],
  });

  return (invoices as any[]).map((inv) => {
    const invoicedLiters = toNum(inv.liters);
    const receivedLiters = (inv.dispatchReceptions ?? []).reduce(
      (s: number, dr: any) => s + toNum(dr.receivedLiters), 0
    );
    const differential = round(receivedLiters - invoicedLiters);
    const differentialPercent = invoicedLiters > 0
      ? round((differential / invoicedLiters) * 100) : 0;
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      controlNumber: inv.controlNumber,
      dispatchDate: inv.dispatchDate,
      driverName: inv.driverName,
      driverIdNumber: inv.driverIdNumber,
      truckPlate: inv.truckPlate,
      tankPlate: inv.tankPlate,
      fuelKind: inv.fuelType,
      invoicedLiters,
      receivedLiters,
      differential,
      differentialPercent,
      gasStation: inv.receivingGasStation,
    };
  });
}

// ─── 2. Ranking de choferes ───────────────────────────────────────────────────

export async function computeDriverAudit(
  gasStationId: string | undefined,
  startDate: Date | undefined,
  endDate: Date | undefined,
  ctx: Context
) {
  const where: any = {};
  if (gasStationId) where.gasStationId = gasStationId;
  Object.assign(where, buildDateWhere("dispatchDate", startDate, endDate));

  const invoices = await ctx.models.Invoice.findAll({
    where,
    include: [{ model: ctx.models.DispatchReception, as: "dispatchReceptions", required: false }],
  });

  const driverMap = new Map<string, any>();
  for (const inv of invoices as any[]) {
    const key = `${inv.driverIdNumber}__${inv.truckPlate}`;
    const invoicedLiters = toNum(inv.liters);
    const receivedLiters = (inv.dispatchReceptions ?? []).reduce(
      (s: number, dr: any) => s + toNum(dr.receivedLiters), 0
    );
    const diff = receivedLiters - invoicedLiters;
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        driverName: inv.driverName, driverIdNumber: inv.driverIdNumber, truckPlate: inv.truckPlate,
        totalDeliveries: 0, totalInvoicedLiters: 0, totalReceivedLiters: 0,
        totalDifferential: 0, shortDeliveries: 0, excessDeliveries: 0,
      });
    }
    const d = driverMap.get(key);
    d.totalDeliveries++;
    d.totalInvoicedLiters += invoicedLiters;
    d.totalReceivedLiters += receivedLiters;
    d.totalDifferential += diff;
    if (diff < 0) d.shortDeliveries++;
    else if (diff > 0) d.excessDeliveries++;
  }

  return Array.from(driverMap.values()).map((d) => ({
    ...d,
    totalInvoicedLiters: round(d.totalInvoicedLiters),
    totalReceivedLiters: round(d.totalReceivedLiters),
    totalDifferential: round(d.totalDifferential),
    avgDifferentialPercent: d.totalInvoicedLiters > 0
      ? round((d.totalDifferential / d.totalInvoicedLiters) * 100) : 0,
  })).sort((a, b) => a.totalDifferential - b.totalDifferential);
}

// ─── 3. Auditoría de turno ─────────────────────────────────────────────────────
// T-033 (H-021 riesgo #9): antes, 3 queries POR TURNO (computeShiftAuditRow). Ahora, 3 queries
// TOTALES sin importar cuántos turnos entren, agregadas en SQL y repartidas por shiftId en JS.
// Mismas reglas exactas que antes — ver el detalle de cada campo en los comentarios de abajo.

async function computeShiftAuditRows(shifts: any[], ctx: Context) {
  if (shifts.length === 0) return [];
  const shiftIds = shifts.map((s) => s.id);

  // meterDeltaLiters: Σ(final − initial) de boquillas con AMBAS lecturas en el turno. Si
  // ninguna boquilla tiene las dos, el turno no aparece en el resultado → queda null (no 0).
  // unique_reading_per_nozzle_shift_type garantiza como mucho una fila por (turno, boquilla,
  // tipo), así que MAX() por tipo equivale a "la" lectura de ese tipo, sin ambigüedad.
  const meterRows = await ctx.sequelize.query<{ employeeShiftId: string; meterDeltaLiters: string }>(
    `
    SELECT "employeeShiftId", SUM(final_reading - initial_reading) AS "meterDeltaLiters"
    FROM (
      SELECT "employeeShiftId", "dispenserNozzleId",
        MAX(CASE WHEN "readingType" = 'INITIAL' THEN "meterReading" END) AS initial_reading,
        MAX(CASE WHEN "readingType" = 'FINAL' THEN "meterReading" END) AS final_reading
      FROM dispenser_readings
      WHERE "employeeShiftId" IN (:shiftIds)
      GROUP BY "employeeShiftId", "dispenserNozzleId"
    ) nozzle_pairs
    WHERE initial_reading IS NOT NULL AND final_reading IS NOT NULL
    GROUP BY "employeeShiftId"
    `,
    { replacements: { shiftIds }, type: QueryTypes.SELECT }
  );
  const meterMap = new Map(meterRows.map((r) => [r.employeeShiftId, round(toNum(r.meterDeltaLiters))]));

  // cashierTicketLiters/totalTickets/canceledTickets: totalTickets cuenta TODOS los tickets del
  // turno (incluidos CANCELED); cashierTicketLiters suma actualLitersDispatched solo de los NO
  // cancelados y no nulos — si no hay ninguno que cumpla, SUM(...) FILTER(...) da NULL (mismo
  // null que el bucle original cuando nunca entra al if).
  const ticketRows = await ctx.sequelize.query<{
    shiftId: string; totalTickets: number; canceledTickets: number; cashierTicketLiters: string | null;
  }>(
    `
    SELECT "cashierShiftId" AS "shiftId",
      COUNT(*)::int AS "totalTickets",
      COUNT(*) FILTER (WHERE status = 'CANCELED')::int AS "canceledTickets",
      SUM("actualLitersDispatched") FILTER (WHERE status <> 'CANCELED' AND "actualLitersDispatched" IS NOT NULL) AS "cashierTicketLiters"
    FROM sales_tickets
    WHERE "cashierShiftId" IN (:shiftIds)
    GROUP BY "cashierShiftId"
    `,
    { replacements: { shiftIds }, type: QueryTypes.SELECT }
  );
  const ticketMap = new Map(ticketRows.map((r) => [r.shiftId, r]));

  // tankMeasurementLiters: dispensedVolumeSinceLastMeasurement de la última medición
  // SHIFT_CLOSURE del turno (o null si no hay ninguna) — DISTINCT ON hace lo mismo que
  // findOne({order: measurementTime DESC}) pero para todos los turnos en una sola consulta.
  const tankRows = await ctx.sequelize.query<{
    employeeShiftId: string; dispensedVolumeSinceLastMeasurement: string | null;
  }>(
    `
    SELECT DISTINCT ON ("employeeShiftId") "employeeShiftId", "dispensedVolumeSinceLastMeasurement"
    FROM tank_measurements
    WHERE "employeeShiftId" IN (:shiftIds) AND "measurementReason" = :reason
    ORDER BY "employeeShiftId", "measurementTime" DESC
    `,
    { replacements: { shiftIds, reason: MeasurementReason.SHIFT_CLOSURE }, type: QueryTypes.SELECT }
  );
  const tankMap = new Map(tankRows.map((r) => [r.employeeShiftId, r]));

  return shifts.map((shift) => {
    const shiftId = shift.id;
    const meterDeltaLiters = meterMap.get(shiftId) ?? null;

    const t = ticketMap.get(shiftId);
    const totalTickets = t?.totalTickets ?? 0;
    const canceledTickets = t?.canceledTickets ?? 0;
    const cashierTicketLiters = t?.cashierTicketLiters != null ? round(toNum(t.cashierTicketLiters)) : null;

    const tankRow = tankMap.get(shiftId);
    const tankMeasurementLiters = tankRow ? toNum(tankRow.dispensedVolumeSinceLastMeasurement) : null;

    const meterVsCashierDiff = meterDeltaLiters !== null && cashierTicketLiters !== null
      ? round(meterDeltaLiters - cashierTicketLiters) : null;
    const cashierVsTankDiff = cashierTicketLiters !== null && tankMeasurementLiters !== null
      ? round(cashierTicketLiters - tankMeasurementLiters) : null;
    const meterVsTankDiff = meterDeltaLiters !== null && tankMeasurementLiters !== null
      ? round(meterDeltaLiters - tankMeasurementLiters) : null;

    return {
      shift, meterDeltaLiters, cashierTicketLiters, tankMeasurementLiters,
      meterVsCashierDiff, cashierVsTankDiff, meterVsTankDiff, totalTickets, canceledTickets,
    };
  });
}

export async function computeShiftAuditRow(shift: any, ctx: Context) {
  return (await computeShiftAuditRows([shift], ctx))[0];
}

export async function computeShiftAudit(
  gasStationId: string,
  startDate: Date | undefined,
  endDate: Date | undefined,
  ctx: Context
) {
  const where: any = { gasStationId };
  Object.assign(where, buildDateWhere("shiftStartTime", startDate, endDate));
  const shifts = await ctx.models.EmployeeShift.findAll({
    where,
    include: [
      { model: ctx.models.Employee, as: "employee" },
      { model: ctx.models.GasStation, as: "gasStation" },
    ],
    order: [["shiftStartTime", "DESC"]],
  });
  return computeShiftAuditRows(shifts as any[], ctx);
}

// ─── 4. Rendimiento por bombero ───────────────────────────────────────────────

export async function computeDispatcherAudit(
  gasStationId: string,
  startDate: Date | undefined,
  endDate: Date | undefined,
  ctx: Context
) {
  const ticketWhere: any = { gasStationId };
  Object.assign(ticketWhere, buildDateWhere("ticketIssueTime", startDate, endDate));
  ticketWhere.dispatcherEmployeeId = { [Op.not]: null };
  ticketWhere.actualLitersDispatched = { [Op.not]: null };

  const tickets = await ctx.models.SalesTicket.findAll({
    where: ticketWhere,
    include: [{ model: ctx.models.Employee, as: "dispatcherEmployee" }],
  });

  const empMap = new Map<string, any>();
  for (const t of tickets as any[]) {
    const empId = t.dispatcherEmployeeId;
    if (!empId) continue;
    const requested = toNum(t.requestedLiters);
    const dispatched = toNum(t.actualLitersDispatched);
    const diff = dispatched - requested;
    if (!empMap.has(empId)) {
      empMap.set(empId, {
        employee: t.dispatcherEmployee, totalTickets: 0,
        totalRequestedLiters: 0, totalDispatchedLiters: 0,
        totalDifferential: 0, shortTickets: 0, excessTickets: 0,
      });
    }
    const e = empMap.get(empId);
    e.totalTickets++;
    e.totalRequestedLiters += requested;
    e.totalDispatchedLiters += dispatched;
    e.totalDifferential += diff;
    if (diff < 0) e.shortTickets++;
    else if (diff > 0) e.excessTickets++;
  }

  return Array.from(empMap.values()).map((e) => ({
    ...e,
    totalRequestedLiters: round(e.totalRequestedLiters),
    totalDispatchedLiters: round(e.totalDispatchedLiters),
    totalDifferential: round(e.totalDifferential),
    avgDifferentialPerTicket: e.totalTickets > 0 ? round(e.totalDifferential / e.totalTickets) : 0,
    shortTicketPercent: e.totalTickets > 0 ? round((e.shortTickets / e.totalTickets) * 100) : 0,
  })).sort((a, b) => a.totalDifferential - b.totalDifferential);
}

// ─── 5. Balance de tanque ─────────────────────────────────────────────────────
// T-033 (H-021 riesgo #9): antes, hasta 6 queries POR TANQUE. Ahora, 4 queries TOTALES sin
// importar cuántos tanques entren (más el findAll de tanques, que ya existía en
// computeTankBalanceByStation, o el findByPk de un tanque suelto). Mismas reglas exactas.

async function computeTankBalances(tanks: any[], startDate: Date, endDate: Date, ctx: Context) {
  if (tanks.length === 0) return [];
  const tankIds = tanks.map((t) => t.id);

  // opening/closing: volumen de la última medición con measurementTime ≤ start/end. Si un
  // tanque no tiene ninguna medición hasta esa fecha, no aparece en el mapa → fallback a
  // Tank.currentVolumeLiters (idéntico al findOne(...) ?? tank.currentVolumeLiters original).
  const [openingRows, closingRows] = await Promise.all(
    [startDate, endDate].map((date) =>
      ctx.sequelize.query<{ tankId: string; volumeInLiters: string | null }>(
        `
        SELECT DISTINCT ON ("tankId") "tankId", "volumeInLiters"
        FROM tank_measurements
        WHERE "tankId" IN (:tankIds) AND "measurementTime" <= :date
        ORDER BY "tankId", "measurementTime" DESC
        `,
        { replacements: { tankIds, date }, type: QueryTypes.SELECT }
      )
    )
  );
  const openingMap = new Map(openingRows.map((r) => [r.tankId, r.volumeInLiters]));
  const closingMap = new Map(closingRows.map((r) => [r.tankId, r.volumeInLiters]));

  const receptionRows = await ctx.sequelize.query<{ tankId: string; totalReceivedLiters: string }>(
    `
    SELECT "tankId", SUM("receivedLiters") AS "totalReceivedLiters"
    FROM dispatch_receptions
    WHERE "tankId" IN (:tankIds) AND "receptionDate" BETWEEN :startDate AND :endDate
    GROUP BY "tankId"
    `,
    { replacements: { tankIds, startDate, endDate }, type: QueryTypes.SELECT }
  );
  const receivedMap = new Map(receptionRows.map((r) => [r.tankId, toNum(r.totalReceivedLiters)]));

  // dispatched: Σ actualLitersDispatched de tickets COMPLETED del período, despachados por
  // boquillas cuyo dispensador apunta al tanque — el mismo camino tanque→dispensador→boquilla→
  // ticket del original, en un solo JOIN. Un tanque sin dispensadores/boquillas/tickets que
  // califiquen simplemente no sale en el mapa → default 0, igual que el original.
  const dispatchedRows = await ctx.sequelize.query<{ tankId: string; totalDispatchedLiters: string }>(
    `
    SELECT d."tankId", SUM(st."actualLitersDispatched") AS "totalDispatchedLiters"
    FROM dispensers d
    JOIN dispenser_nozzles dn ON dn."dispenserId" = d.id
    JOIN sales_tickets st ON st."dispenserNozzleId" = dn.id
    WHERE d."tankId" IN (:tankIds)
      AND st."ticketIssueTime" BETWEEN :startDate AND :endDate
      AND st.status = :completed
      AND st."actualLitersDispatched" IS NOT NULL
    GROUP BY d."tankId"
    `,
    {
      replacements: { tankIds, startDate, endDate, completed: SalesTicketStatus.COMPLETED },
      type: QueryTypes.SELECT,
    }
  );
  const dispatchedMap = new Map(dispatchedRows.map((r) => [r.tankId, toNum(r.totalDispatchedLiters)]));

  return tanks.map((tank) => {
    const openingVolumeLiters = toNum(openingMap.get(tank.id) ?? (tank as any).currentVolumeLiters ?? 0);
    const actualClosingVolume = toNum(closingMap.get(tank.id) ?? (tank as any).currentVolumeLiters ?? 0);
    const totalReceivedLiters = round(receivedMap.get(tank.id) ?? 0);
    const totalDispatchedLiters = round(dispatchedMap.get(tank.id) ?? 0);

    const expectedClosingVolume = round(openingVolumeLiters + totalReceivedLiters - totalDispatchedLiters);
    const varianceLiters = round(actualClosingVolume - expectedClosingVolume);
    const variancePercent = expectedClosingVolume !== 0
      ? round((varianceLiters / expectedClosingVolume) * 100) : 0;

    return {
      tank, periodStart: startDate, periodEnd: endDate,
      openingVolumeLiters: round(openingVolumeLiters),
      totalReceivedLiters, totalDispatchedLiters,
      expectedClosingVolume, actualClosingVolume: round(actualClosingVolume),
      varianceLiters, variancePercent,
    };
  });
}

export async function computeTankBalance(
  tankId: string,
  startDate: Date,
  endDate: Date,
  ctx: Context,
  preloadedTank?: any
) {
  const tank = preloadedTank ?? await ctx.models.Tank.findByPk(tankId, {
    include: [
      { model: ctx.models.FuelType, as: "fuelType" },
      { model: ctx.models.TankModel, as: "tankModel" },
    ],
  });
  if (!tank) return null;
  return (await computeTankBalances([tank], startDate, endDate, ctx))[0];
}

export async function computeTankBalanceByStation(
  gasStationId: string,
  startDate: Date,
  endDate: Date,
  ctx: Context
) {
  const tanks = await ctx.models.Tank.findAll({
    where: { gasStationId },
    include: [
      { model: ctx.models.FuelType, as: "fuelType" },
      { model: ctx.models.TankModel, as: "tankModel" },
    ],
  });
  return computeTankBalances(tanks as any[], startDate, endDate, ctx);
}

// ─── 6. Cuadre financiero por turno ──────────────────────────────────────────
// T-033 (H-021 riesgo #9): antes, 1 query POR TURNO (tickets + pagos vía include). Ahora, 2
// queries TOTALES agregadas en SQL. Mismas reglas exactas, incluido el hallazgo H-006 (suma
// montos de distintas monedas sin convertir) — no se toca, solo se cambia cómo se suma.

export async function computeShiftFinancialAudit(
  gasStationId: string,
  startDate: Date | undefined,
  endDate: Date | undefined,
  ctx: Context
) {
  const where: any = { gasStationId };
  Object.assign(where, buildDateWhere("shiftStartTime", startDate, endDate));

  const shifts = await ctx.models.EmployeeShift.findAll({
    where,
    include: [
      { model: ctx.models.Employee, as: "employee" },
      { model: ctx.models.GasStation, as: "gasStation" },
    ],
    order: [["shiftStartTime", "DESC"]],
  });
  if (shifts.length === 0) return [];
  const shiftIds = (shifts as any[]).map((s) => s.id);

  const ticketRows = await ctx.sequelize.query<{
    shiftId: string; totalTickets: number; completedTickets: number; canceledTickets: number;
    totalExpectedAmount: string | null;
  }>(
    `
    SELECT "cashierShiftId" AS "shiftId",
      COUNT(*)::int AS "totalTickets",
      COUNT(*) FILTER (WHERE status = :completed)::int AS "completedTickets",
      COUNT(*) FILTER (WHERE status = :canceled)::int AS "canceledTickets",
      SUM("totalAmountExpected") AS "totalExpectedAmount"
    FROM sales_tickets
    WHERE "cashierShiftId" IN (:shiftIds)
    GROUP BY "cashierShiftId"
    `,
    {
      replacements: {
        shiftIds,
        completed: SalesTicketStatus.COMPLETED,
        canceled: SalesTicketStatus.CANCELED,
      },
      type: QueryTypes.SELECT,
    }
  );
  const ticketMap = new Map(ticketRows.map((r) => [r.shiftId, r]));

  const paymentRows = await ctx.sequelize.query<{
    shiftId: string; totalCollectedAmount: string; cashAmount: string; electronicAmount: string;
  }>(
    `
    SELECT st."cashierShiftId" AS "shiftId",
      SUM(p.amount) AS "totalCollectedAmount",
      SUM(p.amount) FILTER (WHERE p."paymentMethod" = :cash) AS "cashAmount",
      SUM(p.amount) FILTER (WHERE p."paymentMethod" <> :cash) AS "electronicAmount"
    FROM payments p
    JOIN sales_tickets st ON st.id = p."salesTicketId"
    WHERE st."cashierShiftId" IN (:shiftIds)
    GROUP BY st."cashierShiftId"
    `,
    { replacements: { shiftIds, cash: PaymentMethod.CASH }, type: QueryTypes.SELECT }
  );
  const paymentMap = new Map(paymentRows.map((r) => [r.shiftId, r]));

  return (shifts as any[]).map((shift) => {
    const t = ticketMap.get(shift.id);
    const totalTickets = t?.totalTickets ?? 0;
    const completedTickets = t?.completedTickets ?? 0;
    const canceledTickets = t?.canceledTickets ?? 0;
    const pendingTickets = totalTickets - completedTickets - canceledTickets;
    const totalExpectedAmount = round(toNum(t?.totalExpectedAmount));

    const p = paymentMap.get(shift.id);
    const totalCollectedAmount = round(toNum(p?.totalCollectedAmount));
    const cashAmount = round(toNum(p?.cashAmount));
    const electronicAmount = round(toNum(p?.electronicAmount));

    return {
      shift,
      totalExpectedAmount,
      totalCollectedAmount,
      financialDifferential: round(totalCollectedAmount - totalExpectedAmount),
      cashAmount,
      electronicAmount,
      totalTickets,
      completedTickets, canceledTickets, pendingTickets,
    };
  });
}

// ─── 7. Margen de ganancia (para snapshot) ────────────────────────────────────

export async function computeProfitMargin(
  gasStationId: string,
  startDate: Date,
  endDate: Date,
  ctx: Context
) {
  const tickets = await ctx.models.SalesTicket.findAll({
    where: {
      gasStationId,
      status: SalesTicketStatus.COMPLETED,
      ticketIssueTime: { [Op.between]: [startDate, endDate] },
    } as any,
  });
  const totalRevenue = round(
    (tickets as any[]).reduce((s, t) => s + toNum(t.totalAmountExpected), 0), 2
  );

  const invoices = await ctx.models.Invoice.findAll({
    where: { gasStationId, dispatchDate: { [Op.between]: [startDate, endDate] } },
    include: [{ model: ctx.models.InvoicePayment, as: "invoicePayments", required: false }],
  });
  const totalInvoicedCost = round(
    (invoices as any[]).reduce((s, inv) => s + toNum(inv.totalAmount), 0), 2
  );
  const totalPaidCost = round(
    (invoices as any[]).reduce((s, inv) => {
      const paid = (inv.invoicePayments ?? []).reduce((ps: number, p: any) => ps + toNum(p.amount), 0);
      return s + paid;
    }, 0), 2
  );

  const grossMargin = round(totalRevenue - totalPaidCost, 2);
  const grossMarginPercent = totalRevenue > 0 ? round((grossMargin / totalRevenue) * 100, 2) : 0;
  const pendingInvoicesAmount = round(totalInvoicedCost - totalPaidCost, 2);

  return { totalRevenue, totalInvoicedCost, totalPaidCost, grossMargin, grossMarginPercent, pendingInvoicesAmount };
}
