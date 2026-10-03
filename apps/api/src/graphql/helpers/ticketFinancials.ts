import { QueryTypes, Transaction } from "sequelize";
import { Context } from "../../interfaces";
import { round, toNum } from "./auditHelpers";

export const MONEY_EPSILON = 0.005;

interface TicketFinancialRow {
  id: string;
  dispatcherEmployeeId: string | null;
  dispatcherShiftId: string | null;
  status: string;
  paymentMode: string;
  totalAmountExpected: string;
  actualLitersDispatched: string | null;
  pricePerLiter: string;
  ticketRate: string;
  paidBase: string;
  refundedBase: string;
}

export interface TicketFinancials {
  paidAmount: number;
  dispatchedAmount: number;
  refundedAmount: number;
  differentialAmount: number;
  differentialLiters: number;
  grossAmount: number;
  grossLiters: number;
  refundedLiters: number;
  remainingBase: number;
  dispatcherEmployeeId: string | null;
  dispatcherShiftId: string | null;
  status: string;
}

export async function loadTicketFinancialRows(
  ctx: Context,
  whereSql: string,
  replacements: Record<string, unknown>,
  transaction?: Transaction
): Promise<TicketFinancialRow[]> {
  return ctx.sequelize.query<TicketFinancialRow>(
    `
    SELECT st.id,
      st."dispatcherEmployeeId",
      st."dispatcherShiftId",
      st.status,
      st."paymentMode",
      st."totalAmountExpected",
      st."actualLitersDispatched",
      st."pricePerLiter",
      cur."exchangeRate" AS "ticketRate",
      COALESCE((SELECT SUM(p.amount / p."exchangeRateAtPayment")
                FROM payments p WHERE p."salesTicketId" = st.id), 0) AS "paidBase",
      COALESCE((SELECT SUM(r.amount / r."exchangeRateAtRefund")
                FROM ticket_refunds r WHERE r."salesTicketId" = st.id), 0) AS "refundedBase"
    FROM sales_tickets st
    JOIN sale_type_configs stc ON stc.id = st."assignedSaleTypeConfigId"
    JOIN currencies cur ON cur.id = stc."currencyId"
    WHERE ${whereSql}
    `,
    { replacements, type: QueryTypes.SELECT, transaction }
  );
}

// Diferencial = pagado − despachado − devuelto, en moneda base (D-18). Los montos salen de
// los datos (pagos, total o litros × precio, devoluciones): no hay saldo guardado que pueda
// desincronizarse. En postpago el despachado es el total guardado al despachar (dinero exacto);
// en prepago es litros despachados × precio, porque el total ya no cambia tras el cobro.
// Los litros del diferencial se derivan del dinero: así un ticket pagado exacto da cero.
export function computeTicketFinancials(row: TicketFinancialRow): TicketFinancials {
  const rate = toNum(row.ticketRate);
  const price = toNum(row.pricePerLiter);
  const actual = toNum(row.actualLitersDispatched);
  const paidBase = toNum(row.paidBase);
  const refundedBase = toNum(row.refundedBase);

  const dispatchedBase =
    actual === 0
      ? 0
      : row.paymentMode === "POSTPAID"
        ? toNum(row.totalAmountExpected) / rate
        : (actual * price) / rate;
  const grossBase = paidBase - dispatchedBase;
  const netBase = grossBase - refundedBase;
  const toLiters = (base: number) => (base * rate) / price;

  return {
    paidAmount: round(paidBase, 2),
    dispatchedAmount: round(dispatchedBase, 2),
    refundedAmount: round(refundedBase, 2),
    differentialAmount: round(netBase, 2),
    differentialLiters: round(toLiters(netBase), 3),
    grossAmount: round(grossBase, 2),
    grossLiters: round(toLiters(grossBase), 3),
    refundedLiters: round(toLiters(refundedBase), 3),
    remainingBase: netBase,
    dispatcherEmployeeId: row.dispatcherEmployeeId,
    dispatcherShiftId: row.dispatcherShiftId,
    status: row.status,
  };
}

export async function ticketPaymentCoverage(
  ctx: Context,
  ticketId: string,
  transaction: Transaction
): Promise<{ paidBase: number; dueBase: number }> {
  const [row] = await loadTicketFinancialRows(ctx, `st.id = :ticketId`, { ticketId }, transaction);
  return {
    paidBase: toNum(row.paidBase),
    dueBase: toNum(row.totalAmountExpected) / toNum(row.ticketRate),
  };
}
