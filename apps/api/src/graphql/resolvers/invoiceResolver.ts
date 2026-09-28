import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Invoice as InvoiceModel } from "../../models/invoice"; // Importar el tipo de modelo Invoice
import { belongsTo, hasMany } from "../helpers/dataloaders";

const invoiceResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las facturas
    invoices: async (
      _parent,
      { gasStationId, companyId }: { gasStationId?: string; companyId?: string },
      context: Context
    ) => {
      // Incluir relaciones para evitar N+1 si se piden a menudo
      return context.models.Invoice.findAll({
        where: gasStationId ? { gasStationId } : undefined,
        include: [
          {
            model: context.models.GasStation,
            as: "receivingGasStation",
            where: companyId ? { companyId } : undefined,
            required: !!companyId,
          },
          { model: context.models.Currency, as: "currency" },
          { model: context.models.DispatchReception, as: "dispatchReceptions" },
        ],
      });
    },
    // Obtener una factura por ID
    invoice: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Invoice.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "receivingGasStation" },
          { model: context.models.Currency, as: "currency" },
          { model: context.models.DispatchReception, as: "dispatchReceptions" },
        ],
      });
    },
  },
  Mutation: {
    // Crear una nueva factura
    createInvoice: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const { fuelKind, ...rest } = input;
          const invoice = await context.models.Invoice.create(
            { ...rest, fuelType: fuelKind },
            { transaction: t }
          );
          return invoice;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createInvoice' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the invoice: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una factura existente
    updateInvoice: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const invoice = await context.models.Invoice.findByPk(id, {
            transaction: t,
          });
          if (!invoice) {
            throw new Error("Invoice not found.");
          }
          const { fuelKind, ...rest } = input;
          const updateData = fuelKind !== undefined ? { ...rest, fuelType: fuelKind } : rest;
          await invoice.update(updateData, { transaction: t });
          return invoice;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateInvoice' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while updating the invoice: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Cerrar una factura manualmente
    closeInvoice: async (_parent, { id }: { id: string }, context: Context) => {
      try {
        const invoice = await context.models.Invoice.findByPk(id);
        if (!invoice) throw new Error("Invoice not found.");
        if (invoice.status === 'CLOSED') throw new Error("La factura ya está cerrada.");
        await invoice.update({ status: 'CLOSED' });
        return invoice;
      } catch (error: any) {
        console.error(`❌ Error in 'closeInvoice' mutation:`, error.message || error);
        throw new Error(`An error occurred while closing the invoice: ${error.message || "Unknown error"}`);
      }
    },
    // Eliminar una factura
    deleteInvoice: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.Invoice.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteInvoice' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the invoice: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo ---
  Invoice: {
    fuelKind: (parent: InvoiceModel) => parent.fuelType,
    receivingGasStation: belongsTo("receivingGasStation", "GasStation", "gasStationId"),
    currency: belongsTo("currency", "Currency", "currencyId"),
    dispatchReceptions: hasMany("dispatchReceptions", "DispatchReception", "invoiceId"),
    invoicePayments: hasMany("invoicePayments", "InvoicePayment", "invoiceId"),
    paymentStatus: async (parent: InvoiceModel, _args, context: Context) => {
      const payments =
        (parent as any).invoicePayments !== undefined
          ? (parent as any).invoicePayments
          : await context.loaders.byForeignKey("InvoicePayment", "invoiceId").load(parent.id);
      const totalAmount = parseFloat(String(parent.totalAmount ?? 0));
      const totalPaid = payments.reduce((s: number, p: any) => s + parseFloat(String(p.amount ?? 0)), 0);
      if (totalPaid >= totalAmount) return "PAID";
      if (totalPaid > 0) return "PARTIAL";
      return "PENDING";
    },
  },
};

export default invoiceResolver;
