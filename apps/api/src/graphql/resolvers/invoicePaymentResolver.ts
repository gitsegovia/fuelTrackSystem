import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Op } from "sequelize";
import { SalesTicketStatus } from "../../utils/types";
import { InvoicePayment as InvoicePaymentModel } from "../../models/invoicePayment";

function toNum(v: any): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function round(v: number, dec = 2): number {
  return Math.round(v * 10 ** dec) / 10 ** dec;
}

async function buildInvoiceBalance(invoiceId: string, ctx: Context) {
  const invoice = await ctx.models.Invoice.findByPk(invoiceId, {
    include: [
      { model: ctx.models.GasStation, as: "receivingGasStation" },
      { model: ctx.models.Currency, as: "currency" },
      { model: ctx.models.InvoicePayment, as: "invoicePayments", required: false },
    ],
  });
  if (!invoice) throw new Error("Invoice not found");

  const payments = (invoice as any).invoicePayments ?? [];
  const totalAmount = toNum((invoice as any).totalAmount);
  const totalPaid = round(payments.reduce((s: number, p: any) => s + toNum(p.amount), 0));
  const balance = round(totalAmount - totalPaid);

  let paymentStatus = "PENDING";
  if (totalPaid >= totalAmount) paymentStatus = "PAID";
  else if (totalPaid > 0) paymentStatus = "PARTIAL";

  return { invoice, totalAmount, totalPaid, balance, paymentStatus, payments };
}

const invoicePaymentResolver: IResolvers<Context> = {
  Query: {
    invoicePayment: async (_, { id }: { id: string }, ctx: Context) => {
      return ctx.models.InvoicePayment.findByPk(id, {
        include: [
          { model: ctx.models.Invoice, as: "invoice" },
          { model: ctx.models.User, as: "recordedBy" },
        ],
      });
    },

    invoicePayments: async (_, { invoiceId }: { invoiceId: string }, ctx: Context) => {
      return ctx.models.InvoicePayment.findAll({
        where: { invoiceId },
        include: [{ model: ctx.models.User, as: "recordedBy" }],
        order: [["paymentDate", "DESC"]],
      });
    },

    invoiceBalance: async (_, { invoiceId }: { invoiceId: string }, ctx: Context) => {
      return buildInvoiceBalance(invoiceId, ctx);
    },

    invoicePaymentsByStation: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => {
      const invoiceWhere: any = { gasStationId };
      if (startDate && endDate) invoiceWhere.dispatchDate = { [Op.between]: [startDate, endDate] };
      else if (startDate) invoiceWhere.dispatchDate = { [Op.gte]: startDate };
      else if (endDate) invoiceWhere.dispatchDate = { [Op.lte]: endDate };

      return ctx.models.InvoicePayment.findAll({
        include: [
          {
            model: ctx.models.Invoice,
            as: "invoice",
            where: invoiceWhere,
            required: true,
          },
          { model: ctx.models.User, as: "recordedBy" },
        ],
        order: [["paymentDate", "DESC"]],
      });
    },

    unpaidInvoices: async (_, { gasStationId }: { gasStationId: string }, ctx: Context) => {
      const invoices = await ctx.models.Invoice.findAll({
        where: { gasStationId },
        include: [
          { model: ctx.models.GasStation, as: "receivingGasStation" },
          { model: ctx.models.Currency, as: "currency" },
          { model: ctx.models.InvoicePayment, as: "invoicePayments", required: false },
        ],
        order: [["dispatchDate", "DESC"]],
      });

      return (invoices as any[])
        .map((invoice) => {
          const payments = invoice.invoicePayments ?? [];
          const totalAmount = toNum(invoice.totalAmount);
          const totalPaid = round(payments.reduce((s: number, p: any) => s + toNum(p.amount), 0));
          const balance = round(totalAmount - totalPaid);
          let paymentStatus = "PENDING";
          if (totalPaid >= totalAmount) paymentStatus = "PAID";
          else if (totalPaid > 0) paymentStatus = "PARTIAL";
          return { invoice, totalAmount, totalPaid, balance, paymentStatus, payments };
        })
        .filter((b) => b.paymentStatus !== "PAID");
    },

    invoiceProfitMargin: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate: Date; endDate: Date },
      ctx: Context
    ) => {
      // Ingresos: tickets completados en el período
      const tickets = await ctx.models.SalesTicket.findAll({
        where: {
          gasStationId,
          status: SalesTicketStatus.COMPLETED,
          ticketIssueTime: { [Op.between]: [startDate, endDate] },
        } as any,
      });
      const totalRevenue = round(
        (tickets as any[]).reduce((s, t) => s + toNum(t.totalAmountExpected), 0)
      );

      // Costo facturado: facturas con dispatchDate en el período
      const invoices = await ctx.models.Invoice.findAll({
        where: { gasStationId, dispatchDate: { [Op.between]: [startDate, endDate] } },
        include: [{ model: ctx.models.InvoicePayment, as: "invoicePayments", required: false }],
      });
      const totalInvoicedCost = round(
        (invoices as any[]).reduce((s, inv) => s + toNum(inv.totalAmount), 0)
      );
      const totalPaidCost = round(
        (invoices as any[]).reduce((s, inv) => {
          const paid = (inv.invoicePayments ?? []).reduce(
            (ps: number, p: any) => ps + toNum(p.amount), 0
          );
          return s + paid;
        }, 0)
      );

      const grossMargin = round(totalRevenue - totalPaidCost);
      const grossMarginPercent = totalRevenue > 0
        ? round((grossMargin / totalRevenue) * 100)
        : 0;
      const pendingInvoicesAmount = round(totalInvoicedCost - totalPaidCost);

      return {
        gasStationId,
        periodStart: startDate,
        periodEnd: endDate,
        totalRevenue,
        totalInvoicedCost,
        totalPaidCost,
        grossMargin,
        grossMarginPercent,
        pendingInvoicesAmount,
      };
    },
  },

  Mutation: {
    createInvoicePayment: async (_, { input }, ctx: Context) => {
      try {
        const payment = await ctx.models.InvoicePayment.create(input);
        return ctx.models.InvoicePayment.findByPk(payment.id, {
          include: [
            { model: ctx.models.Invoice, as: "invoice" },
            { model: ctx.models.User, as: "recordedBy" },
          ],
        }) as any;
      } catch (error: any) {
        console.error("❌ Error in 'createInvoicePayment':", error.message);
        throw new Error(`Error al registrar el pago: ${error.message}`);
      }
    },

    updateInvoicePayment: async (_, { id, input }, ctx: Context) => {
      try {
        const payment = await ctx.models.InvoicePayment.findByPk(id);
        if (!payment) throw new Error("Pago no encontrado.");
        await payment.update(input);
        return ctx.models.InvoicePayment.findByPk(id, {
          include: [
            { model: ctx.models.Invoice, as: "invoice" },
            { model: ctx.models.User, as: "recordedBy" },
          ],
        });
      } catch (error: any) {
        console.error("❌ Error in 'updateInvoicePayment':", error.message);
        throw new Error(`Error al actualizar el pago: ${error.message}`);
      }
    },

    deleteInvoicePayment: async (_, { id }: { id: string }, ctx: Context) => {
      try {
        const deleted = await ctx.models.InvoicePayment.destroy({ where: { id } });
        return deleted > 0;
      } catch (error: any) {
        console.error("❌ Error in 'deleteInvoicePayment':", error.message);
        throw new Error(`Error al eliminar el pago: ${error.message}`);
      }
    },
  },

  InvoicePayment: {
    invoice: async (parent: InvoicePaymentModel, _, ctx: Context) => parent.getInvoice(),
    recordedBy: async (parent: InvoicePaymentModel, _, ctx: Context) => parent.getRecordedBy(),
  },
};

export default invoicePaymentResolver;
