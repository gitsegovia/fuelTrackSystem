import { Op } from "sequelize";
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

// ─── 3. Auditoría de turno (row) ──────────────────────────────────────────────

export async function computeShiftAuditRow(shift: any, ctx: Context) {
  const shiftId = shift.id;

  const readings = await ctx.models.DispenserReading.findAll({
    where: { employeeShiftId: shiftId },
  });
  const nozzleMap = new Map<string, { initial?: number; final?: number }>();
  for (const r of readings as any[]) {
    if (!nozzleMap.has(r.dispenserNozzleId)) nozzleMap.set(r.dispenserNozzleId, {});
    const entry = nozzleMap.get(r.dispenserNozzleId)!;
    if (r.readingType === "INITIAL") entry.initial = toNum(r.meterReading);
    else entry.final = toNum(r.meterReading);
  }
  let meterDeltaLiters: number | null = null;
  for (const { initial, final } of nozzleMap.values()) {
    if (initial !== undefined && final !== undefined) {
      if (meterDeltaLiters === null) meterDeltaLiters = 0;
      meterDeltaLiters += final - initial;
    }
  }
  if (meterDeltaLiters !== null) meterDeltaLiters = round(meterDeltaLiters);

  const tickets = await ctx.models.SalesTicket.findAll({ where: { cashierShiftId: shiftId } });
  let cashierTicketLiters: number | null = null;
  let totalTickets = 0;
  let canceledTickets = 0;
  for (const t of tickets as any[]) {
    totalTickets++;
    if (t.status === SalesTicketStatus.CANCELED) { canceledTickets++; continue; }
    if (t.actualLitersDispatched != null) {
      if (cashierTicketLiters === null) cashierTicketLiters = 0;
      cashierTicketLiters += toNum(t.actualLitersDispatched);
    }
  }
  if (cashierTicketLiters !== null) cashierTicketLiters = round(cashierTicketLiters);

  const tankMeasurement = await ctx.models.TankMeasurement.findOne({
    where: { employeeShiftId: shiftId, measurementReason: MeasurementReason.SHIFT_CLOSURE },
    order: [["measurementTime", "DESC"]],
  });
  const tankMeasurementLiters = tankMeasurement
    ? toNum((tankMeasurement as any).dispensedVolumeSinceLastMeasurement)
    : null;

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
  return Promise.all((shifts as any[]).map((s) => computeShiftAuditRow(s, ctx)));
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

  const openingMeasurement = await ctx.models.TankMeasurement.findOne({
    where: { tankId, measurementTime: { [Op.lte]: startDate } },
    order: [["measurementTime", "DESC"]],
  });
  const closingMeasurement = await ctx.models.TankMeasurement.findOne({
    where: { tankId, measurementTime: { [Op.lte]: endDate } },
    order: [["measurementTime", "DESC"]],
  });

  const openingVolumeLiters = toNum((openingMeasurement as any)?.volumeInLiters ?? (tank as any).currentVolumeLiters ?? 0);
  const actualClosingVolume = toNum((closingMeasurement as any)?.volumeInLiters ?? (tank as any).currentVolumeLiters ?? 0);

  const receptions = await ctx.models.DispatchReception.findAll({
    where: { tankId, receptionDate: { [Op.between]: [startDate, endDate] } },
  });
  const totalReceivedLiters = round(
    (receptions as any[]).reduce((s, r) => s + toNum(r.receivedLiters), 0)
  );

  const dispensers = await ctx.models.Dispenser.findAll({ where: { tankId } });
  const dispenserIds = (dispensers as any[]).map((d) => d.id);
  let totalDispatchedLiters = 0;
  if (dispenserIds.length > 0) {
    const nozzles = await ctx.models.DispenserNozzle.findAll({
      where: { dispenserId: { [Op.in]: dispenserIds } },
    });
    const nozzleIds = (nozzles as any[]).map((n) => n.id);
    if (nozzleIds.length > 0) {
      const tickets = await ctx.models.SalesTicket.findAll({
        where: {
          dispenserNozzleId: { [Op.in]: nozzleIds },
          ticketIssueTime: { [Op.between]: [startDate, endDate] },
          status: SalesTicketStatus.COMPLETED,
          actualLitersDispatched: { [Op.not]: null },
        } as any,
      });
      totalDispatchedLiters = round(
        (tickets as any[]).reduce((s, t) => s + toNum(t.actualLitersDispatched), 0)
      );
    }
  }

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
  return Promise.all((tanks as any[]).map((t) => computeTankBalance(t.id, startDate, endDate, ctx, t)));
}

// ─── 6. Cuadre financiero por turno ──────────────────────────────────────────

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

  return Promise.all((shifts as any[]).map(async (shift) => {
    const tickets = await ctx.models.SalesTicket.findAll({
      where: { cashierShiftId: shift.id },
      include: [{ model: ctx.models.Payment, as: "payments" }],
    });

    let totalExpectedAmount = 0, totalCollectedAmount = 0;
    let cashAmount = 0, electronicAmount = 0;
    let completedTickets = 0, canceledTickets = 0, pendingTickets = 0;

    for (const t of tickets as any[]) {
      totalExpectedAmount += toNum(t.totalAmountExpected);
      if (t.status === SalesTicketStatus.COMPLETED) completedTickets++;
      else if (t.status === SalesTicketStatus.CANCELED) canceledTickets++;
      else pendingTickets++;

      for (const p of t.payments ?? []) {
        const amount = toNum(p.amount);
        totalCollectedAmount += amount;
        if (p.paymentMethod === PaymentMethod.CASH) cashAmount += amount;
        else electronicAmount += amount;
      }
    }

    return {
      shift,
      totalExpectedAmount: round(totalExpectedAmount),
      totalCollectedAmount: round(totalCollectedAmount),
      financialDifferential: round(totalCollectedAmount - totalExpectedAmount),
      cashAmount: round(cashAmount),
      electronicAmount: round(electronicAmount),
      totalTickets: tickets.length,
      completedTickets, canceledTickets, pendingTickets,
    };
  }));
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
