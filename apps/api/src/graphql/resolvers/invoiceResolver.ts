import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Invoice as InvoiceModel } from "../../models/invoice"; // Importar el tipo de modelo Invoice

const invoiceResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las facturas
    invoices: async (_parent, _args, context: Context) => {
      // Incluir relaciones para evitar N+1 si se piden a menudo
      return context.models.Invoice.findAll({
        include: [
          { model: context.models.GasStation, as: "receivingGasStation" },
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
    receivingGasStation: async (
      parent: InvoiceModel,
      _args,
      _context: Context
    ) => {
      return parent.getReceivingGasStation();
    },
    currency: async (parent: InvoiceModel, _args, _context: Context) => {
      return parent.getCurrency();
    },
    dispatchReceptions: async (
      parent: InvoiceModel,
      _args,
      _context: Context
    ) => {
      return parent.getDispatchReceptions();
    },
  },
};

export default invoiceResolver;
