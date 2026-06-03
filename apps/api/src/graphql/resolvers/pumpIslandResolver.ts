import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { PumpIsland as PumpIslandModel } from "../../models/pumpIsland"; // Importar el tipo de modelo

const pumpIslandResolver: IResolvers<Context> = {
  Query: {
    // Obtener todos los andenes
    pumpIslands: async (_parent, _args, context: Context) => {
      return context.models.PumpIsland.findAll({
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          // { model: context.models.Dispenser, as: 'dispensers' }, // Descomentar cuando Dispenser esté listo
        ],
      });
    },
    // Obtener un andén por ID
    pumpIsland: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.PumpIsland.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          // { model: context.models.Dispenser, as: 'dispensers' },
        ],
      });
    },
    // Obtener andenes por ID de estación de servicio
    pumpIslandsByGasStation: async (
      _parent,
      { gasStationId }: { gasStationId: string },
      context: Context
    ) => {
      return context.models.PumpIsland.findAll({
        where: { gasStationId },
        include: [{ model: context.models.GasStation, as: "gasStation" }],
      });
    },
    // Obtener un andén por estación de servicio y nombre (usando el índice único)
    pumpIslandByGasStationAndName: async (
      _parent,
      { gasStationId, name }: { gasStationId: string; name: string },
      context: Context
    ) => {
      return context.models.PumpIsland.findOne({
        where: {
          gasStationId,
          name,
        },
        include: [{ model: context.models.GasStation, as: "gasStation" }],
      });
    },
  },
  Mutation: {
    // Crear un nuevo andén
    createPumpIsland: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const pumpIsland = await context.models.PumpIsland.create(input, {
            transaction: t,
          });
          return pumpIsland;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createPumpIsland' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A pump island with this name already exists for this gas station."
          );
        }
        throw new Error(
          `An error occurred while creating the pump island: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar un andén existente
    updatePumpIsland: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const pumpIsland = await context.models.PumpIsland.findByPk(id, {
            transaction: t,
          });
          if (!pumpIsland) {
            throw new Error("Pump island not found.");
          }
          await pumpIsland.update(input, { transaction: t });
          return pumpIsland;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updatePumpIsland' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate pump island name for this gas station."
          );
        }
        throw new Error(
          `An error occurred while updating the pump island: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar un andén
    deletePumpIsland: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.PumpIsland.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deletePumpIsland' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the pump island: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  PumpIsland: {
    gasStation: async (parent: PumpIslandModel, _args, _context: Context) => {
      return parent.getGasStation();
    },
    dispensers: async (parent: PumpIslandModel, _args, _context: Context) => {
      return parent.getDispensers();
    },
  },
};

export default pumpIslandResolver;
