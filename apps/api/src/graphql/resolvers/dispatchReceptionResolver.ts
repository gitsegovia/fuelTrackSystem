import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { DispatchReception as DispatchReceptionModel } from "../../models/dispatchReception"; // Importar el tipo de modelo

const dispatchReceptionResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las recepciones de despacho
    dispatchReceptions: async (_parent, _args, context: Context) => {
      return context.models.DispatchReception.findAll({
        include: [
          { model: context.models.Invoice, as: "invoice" },
          { model: context.models.Tank, as: "tank" },
          // { model: context.models.TankAssignment, as: 'tankAssignments' }, // Descomentar cuando TankAssignment esté lista
        ],
      });
    },
    // Obtener una recepción de despacho por ID
    dispatchReception: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.DispatchReception.findByPk(id, {
        include: [
          { model: context.models.Invoice, as: "invoice" },
          { model: context.models.Tank, as: "tank" },
          // { model: context.models.TankAssignment, as: 'tankAssignments' },
        ],
      });
    },
    // Obtener recepciones de despacho por ID de tanque
    dispatchReceptionsByTank: async (
      _parent,
      { tankId }: { tankId: string },
      context: Context
    ) => {
      return context.models.DispatchReception.findAll({
        where: { tankId },
        include: [
          { model: context.models.Invoice, as: "invoice" },
          { model: context.models.Tank, as: "tank" },
        ],
      });
    },
    // Obtener una recepción de despacho por factura y tanque (usando el índice único)
    dispatchReceptionByInvoiceAndTank: async (
      _parent,
      { invoiceId, tankId }: { invoiceId: string; tankId: string },
      context: Context
    ) => {
      return context.models.DispatchReception.findOne({
        where: {
          invoiceId,
          tankId,
        },
        include: [
          { model: context.models.Invoice, as: "invoice" },
          { model: context.models.Tank, as: "tank" },
        ],
      });
    },
  },
  Mutation: {
    // Crear una nueva recepción de despacho
    createDispatchReception: async (_parent, { input }, context: Context) => {
      const invoice = await context.models.Invoice.findByPk(input.invoiceId, {
        include: [{ model: context.models.DispatchReception, as: "dispatchReceptions" }],
      });
      if (!invoice) throw new Error("Factura no encontrada.");
      if (invoice.status === "CLOSED") {
        throw new Error("Esta factura ya está cerrada. No se pueden agregar más recepciones.");
      }

      const alreadyReceived = (invoice.dispatchReceptions ?? []).reduce(
        (sum: number, r: any) => sum + parseFloat(r.receivedLiters),
        0
      );
      const newTotal = alreadyReceived + parseFloat(input.receivedLiters);
      const invoiceLiters = parseFloat(invoice.liters as any);

      if (newTotal > invoiceLiters) {
        throw new Error(
          `Litros excedidos. Factura: ${invoiceLiters} L, ya recibidos: ${alreadyReceived} L, intentas registrar: ${input.receivedLiters} L.`
        );
      }

      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const reception = await context.models.DispatchReception.create(input, { transaction: t });
          if (newTotal >= invoiceLiters) {
            await invoice.update({ status: "CLOSED" }, { transaction: t });
          }
          return reception;
        });
        return result;
      } catch (error: any) {
        console.error(`❌ Error in 'createDispatchReception' mutation:`, error.message || error);
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error("Ya existe una recepción para esta factura y este tanque.");
        }
        throw new Error(
          `An error occurred while creating the dispatch reception: ${error.message || "Unknown error"}`
        );
      }
    },
    // Actualizar una recepción de despacho existente
    updateDispatchReception: async (
      _parent,
      { id, input },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const reception = await context.models.DispatchReception.findByPk(
            id,
            { transaction: t }
          );
          if (!reception) {
            throw new Error("Dispatch reception not found.");
          }
          await reception.update(input, { transaction: t });
          return reception;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateDispatchReception' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate for this invoice and tank."
          );
        }
        throw new Error(
          `An error occurred while updating the dispatch reception: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una recepción de despacho
    deleteDispatchReception: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.DispatchReception.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteDispatchReception' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the dispatch reception: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  DispatchReception: {
    invoice: async (
      parent: DispatchReceptionModel,
      _args,
      _context: Context
    ) => {
      return parent.getInvoice();
    },
    tank: async (parent: DispatchReceptionModel, _args, _context: Context) => {
      return parent.getTank();
    },
    tankAssignments: async (
      parent: DispatchReceptionModel,
      _args,
      _context: Context
    ) => {
      return parent.getTankAssignments();
    },
  },
};

export default dispatchReceptionResolver;
