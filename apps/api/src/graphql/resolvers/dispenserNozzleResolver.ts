import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { DispenserNozzle as DispenserNozzleModel } from "../../models/dispenserNozzle";
import { belongsTo, hasMany } from "../helpers/dataloaders";

const dispenserNozzleResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las boquillas
    // H-021 (T-022, riesgo #8): dispenserReadings/salesTickets (hasMany sin límite) fuera del
    // include base; el field resolver de abajo (parent.getX()) los sigue sirviendo si se piden
    // anidados, como ya hacía antes (graphql-js llama al resolver explícito, no lee la
    // propiedad precargada por el include).
    dispenserNozzles: async (_parent, _args, context: Context) => {
      return context.models.DispenserNozzle.findAll({
        include: [{ model: context.models.Dispenser, as: "dispenser" }],
      });
    },
    // Obtener una boquilla por ID
    dispenserNozzle: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.DispenserNozzle.findByPk(id, {
        include: [{ model: context.models.Dispenser, as: "dispenser" }],
      });
    },
    // Obtener boquillas por ID de surtidor
    dispenserNozzlesByDispenser: async (
      _parent,
      { dispenserId }: { dispenserId: string },
      context: Context
    ) => {
      return context.models.DispenserNozzle.findAll({
        where: { dispenserId },
        include: [
          { model: context.models.Dispenser, as: "dispenser" },
          // Se puede optar por no incluir relaciones 'hasMany' aquí por defecto para optimizar
        ],
      });
    },
    // Obtener una boquilla por surtidor y nombre (usando el índice único)
    dispenserNozzleByDispenserAndName: async (
      _parent,
      { dispenserId, name }: { dispenserId: string; name: string },
      context: Context
    ) => {
      return context.models.DispenserNozzle.findOne({
        where: {
          dispenserId,
          name,
        },
        include: [{ model: context.models.Dispenser, as: "dispenser" }],
      });
    },
  },
  Mutation: {
    // Crear una nueva boquilla
    createDispenserNozzle: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const dispenserNozzle = await context.models.DispenserNozzle.create(
            input,
            { transaction: t }
          );
          return dispenserNozzle;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createDispenserNozzle' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A dispenser nozzle with this name already exists for this dispenser."
          );
        }
        throw new Error(
          `An error occurred while creating the dispenser nozzle: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una boquilla existente
    updateDispenserNozzle: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const dispenserNozzle = await context.models.DispenserNozzle.findByPk(
            id,
            { transaction: t }
          );
          if (!dispenserNozzle) {
            throw new Error("Dispenser nozzle not found.");
          }
          await dispenserNozzle.update(input, { transaction: t });
          return dispenserNozzle;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateDispenserNozzle' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate nozzle name for this dispenser."
          );
        }
        throw new Error(
          `An error occurred while updating the dispenser nozzle: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una boquilla
    deleteDispenserNozzle: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.DispenserNozzle.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteDispenserNozzle' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the dispenser nozzle: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  DispenserNozzle: {
    dispenser: belongsTo("dispenser", "Dispenser", "dispenserId"),
    dispenserReadings: hasMany("dispenserReadings", "DispenserReading", "dispenserNozzleId"),
    salesTickets: hasMany("salesTickets", "SalesTicket", "dispenserNozzleId"),
  },
};

export default dispenserNozzleResolver;
