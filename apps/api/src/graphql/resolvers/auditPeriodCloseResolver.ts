import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { AuditPeriodClose as AuditPeriodCloseModel } from "../../models/auditPeriodClose";
import {
  computeInvoiceAudit,
  computeDriverAudit,
  computeShiftAudit,
  computeDispatcherAudit,
  computeTankBalanceByStation,
  computeShiftFinancialAudit,
  computeProfitMargin,
  toNum,
  round,
} from "../helpers/auditHelpers";

async function buildSnapshots(
  gasStationId: string,
  periodStart: Date,
  periodEnd: Date,
  ctx: Context
) {
  const [invoiceSnapshot, driverSnapshot, shiftSnapshot, dispatcherSnapshot, tankSnapshot, financialSnapshot, marginSnapshot] =
    await Promise.all([
      computeInvoiceAudit(gasStationId, periodStart, periodEnd, ctx),
      computeDriverAudit(gasStationId, periodStart, periodEnd, ctx),
      computeShiftAudit(gasStationId, periodStart, periodEnd, ctx),
      computeDispatcherAudit(gasStationId, periodStart, periodEnd, ctx),
      computeTankBalanceByStation(gasStationId, periodStart, periodEnd, ctx),
      computeShiftFinancialAudit(gasStationId, periodStart, periodEnd, ctx),
      computeProfitMargin(gasStationId, periodStart, periodEnd, ctx),
    ]);

  // Serializar: convertir Sequelize instances a plain objects para guardar en JSONB
  function serialize(data: any): any {
    if (Array.isArray(data)) return data.map(serialize);
    if (data === null || data === undefined) return data;
    if (typeof data === "object" && typeof data.toJSON === "function") return serialize(data.toJSON());
    if (data instanceof Date) return data.toISOString();
    if (typeof data === "object") {
      const out: any = {};
      for (const k of Object.keys(data)) out[k] = serialize(data[k]);
      return out;
    }
    return data;
  }

  return {
    invoiceSnapshot: serialize(invoiceSnapshot),
    driverSnapshot: serialize(driverSnapshot),
    shiftSnapshot: serialize(shiftSnapshot),
    dispatcherSnapshot: serialize(dispatcherSnapshot),
    tankSnapshot: serialize(tankSnapshot),
    financialSnapshot: serialize(financialSnapshot),
    marginSnapshot: serialize(marginSnapshot),
  };
}

function buildSummary(close: AuditPeriodCloseModel) {
  const inv = (close.invoiceSnapshot as any[]) ?? [];
  const shifts = (close.shiftSnapshot as any[]) ?? [];
  const margin = close.marginSnapshot as any;

  const totalInvoicedLiters = round(inv.reduce((s, r) => s + toNum(r.invoicedLiters), 0), 2);
  const totalReceivedLiters = round(inv.reduce((s, r) => s + toNum(r.receivedLiters), 0), 2);
  const invoiceDifferential = round(totalReceivedLiters - totalInvoicedLiters, 2);

  return {
    invoiceCount: inv.length,
    totalInvoicedLiters,
    totalReceivedLiters,
    invoiceDifferential,
    shiftCount: shifts.length,
    grossMargin: margin?.grossMargin ?? null,
    grossMarginPercent: margin?.grossMarginPercent ?? null,
    pendingInvoicesAmount: margin?.pendingInvoicesAmount ?? null,
  };
}

const auditPeriodCloseResolver: IResolvers<Context> = {
  Query: {
    auditPeriodCloses: async (_, { gasStationId }: { gasStationId: string }, ctx: Context) => {
      return ctx.models.AuditPeriodClose.findAll({
        where: { gasStationId },
        include: [
          { model: ctx.models.GasStation, as: "gasStation" },
          { model: ctx.models.User, as: "closedBy" },
        ],
        order: [["periodStart", "DESC"]],
      });
    },

    auditPeriodClose: async (_, { id }: { id: string }, ctx: Context) => {
      return ctx.models.AuditPeriodClose.findByPk(id, {
        include: [
          { model: ctx.models.GasStation, as: "gasStation" },
          { model: ctx.models.User, as: "closedBy" },
        ],
      });
    },
  },

  Mutation: {
    createAuditPeriodClose: async (_, { input }, ctx: Context) => {
      try {
        const { gasStationId, closedById, periodStart, periodEnd, closeType } = input;
        const snapshots = await buildSnapshots(gasStationId, new Date(periodStart), new Date(periodEnd), ctx);

        const close = await ctx.models.AuditPeriodClose.create({
          gasStationId, closedById, periodStart, periodEnd, closeType,
          status: "DRAFT",
          ...snapshots,
        });

        return ctx.models.AuditPeriodClose.findByPk(close.id, {
          include: [
            { model: ctx.models.GasStation, as: "gasStation" },
            { model: ctx.models.User, as: "closedBy" },
          ],
        }) as any;
      } catch (error: any) {
        console.error("❌ Error in 'createAuditPeriodClose':", error.message);
        throw new Error(`Error al crear el cierre de período: ${error.message}`);
      }
    },

    confirmAuditPeriodClose: async (_, { id }: { id: string }, ctx: Context) => {
      try {
        const close = await ctx.models.AuditPeriodClose.findByPk(id);
        if (!close) throw new Error("Cierre no encontrado.");
        if (close.status === "CLOSED") throw new Error("Este cierre ya está confirmado.");
        await close.update({ status: "CLOSED" });
        return ctx.models.AuditPeriodClose.findByPk(id, {
          include: [
            { model: ctx.models.GasStation, as: "gasStation" },
            { model: ctx.models.User, as: "closedBy" },
          ],
        }) as any;
      } catch (error: any) {
        console.error("❌ Error in 'confirmAuditPeriodClose':", error.message);
        throw new Error(`Error al confirmar el cierre: ${error.message}`);
      }
    },

    recalculateAuditPeriodClose: async (_, { id }: { id: string }, ctx: Context) => {
      try {
        const close = await ctx.models.AuditPeriodClose.findByPk(id);
        if (!close) throw new Error("Cierre no encontrado.");
        if (close.status === "CLOSED") throw new Error("No se puede recalcular un cierre confirmado.");
        const snapshots = await buildSnapshots(
          close.gasStationId,
          new Date(close.periodStart),
          new Date(close.periodEnd),
          ctx
        );
        await close.update(snapshots);
        return ctx.models.AuditPeriodClose.findByPk(id, {
          include: [
            { model: ctx.models.GasStation, as: "gasStation" },
            { model: ctx.models.User, as: "closedBy" },
          ],
        }) as any;
      } catch (error: any) {
        console.error("❌ Error in 'recalculateAuditPeriodClose':", error.message);
        throw new Error(`Error al recalcular el cierre: ${error.message}`);
      }
    },

    deleteAuditPeriodClose: async (_, { id }: { id: string }, ctx: Context) => {
      try {
        const close = await ctx.models.AuditPeriodClose.findByPk(id);
        if (!close) throw new Error("Cierre no encontrado.");
        if (close.status === "CLOSED") throw new Error("No se puede eliminar un cierre confirmado.");
        await close.destroy();
        return true;
      } catch (error: any) {
        console.error("❌ Error in 'deleteAuditPeriodClose':", error.message);
        throw new Error(`Error al eliminar el cierre: ${error.message}`);
      }
    },
  },

  AuditPeriodClose: {
    gasStation: (parent: AuditPeriodCloseModel) => parent.getGasStation(),
    closedBy: (parent: AuditPeriodCloseModel) => parent.getClosedBy(),
    summary: (parent: AuditPeriodCloseModel) => buildSummary(parent),
  },
};

export default auditPeriodCloseResolver;
