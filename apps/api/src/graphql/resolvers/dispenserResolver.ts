import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Dispenser as DispenserModel } from "../../models/dispenser"; // Importar el tipo de modelo

const dispenserResolver: IResolvers<Context> = {
  Query: {
    // Obtener todos los surtidores
    dispensers: async (_parent, _args, context: Context) => {
      return context.models.Dispenser.findAll({
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
          // { model: context.models.SalesTicket, as: 'salesTickets' }, // Descomentar cuando SalesTicket esté listo
        ],
      });
    },
    // Obtener un surtidor por ID
    dispenser: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Dispenser.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
          // { model: context.models.SalesTicket, as: 'salesTickets' },
        ],
      });
    },
    // Obtener surtidores por ID de estación de servicio
    dispensersByGasStation: async (
      _parent,
      { gasStationId }: { gasStationId: string },
      context: Context
    ) => {
      return context.models.Dispenser.findAll({
        where: { gasStationId },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
        ],
      });
    },
    // Obtener surtidores por ID de andén
    dispensersByPumpIsland: async (
      _parent,
      { pumpIslandId }: { pumpIslandId: string },
      context: Context
    ) => {
      return context.models.Dispenser.findAll({
        where: { pumpIslandId },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
        ],
      });
    },
    // Obtener surtidores por ID de tanque
    dispensersByTank: async (
      _parent,
      { tankId }: { tankId: string },
      context: Context
    ) => {
      return context.models.Dispenser.findAll({
        where: { tankId },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
        ],
      });
    },
    // Obtener surtidores por ID de tipo de combustible
    dispensersByFuelType: async (
      _parent,
      { fuelTypeId }: { fuelTypeId: string },
      context: Context
    ) => {
      return context.models.Dispenser.findAll({
        where: { fuelTypeId },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
        ],
      });
    },
    // Obtener un surtidor por estación de servicio y nombre (usando el índice único)
    dispenserByGasStationAndName: async (
      _parent,
      { gasStationId, name }: { gasStationId: string; name: string },
      context: Context
    ) => {
      return context.models.Dispenser.findOne({
        where: {
          gasStationId,
          name,
        },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.PumpIsland, as: "pumpIsland" },
          { model: context.models.Tank, as: "tank" },
          { model: context.models.FuelType, as: "fuelType" },
        ],
      });
    },
  },
  Mutation: {
    // Crear un nuevo surtidor
    createDispenser: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const dispenser = await context.models.Dispenser.create(input, {
            transaction: t,
          });
          return dispenser;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createDispenser' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A dispenser with this name already exists for this gas station."
          );
        }
        throw new Error(
          `An error occurred while creating the dispenser: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar un surtidor existente
    updateDispenser: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const dispenser = await context.models.Dispenser.findByPk(id, {
            transaction: t,
          });
          if (!dispenser) {
            throw new Error("Dispenser not found.");
          }
          await dispenser.update(input, { transaction: t });
          return dispenser;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateDispenser' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate dispenser name for this gas station."
          );
        }
        throw new Error(
          `An error occurred while updating the dispenser: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar un surtidor
    deleteDispenser: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.Dispenser.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteDispenser' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the dispenser: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  Dispenser: {
    gasStation: async (parent: DispenserModel, _args, _context: Context) => {
      return parent.getGasStation();
    },
    pumpIsland: async (parent: DispenserModel, _args, _context: Context) => {
      return parent.getPumpIsland();
    },
    tank: async (parent: DispenserModel, _args, _context: Context) => {
      return parent.getTank();
    },
    fuelType: async (parent: DispenserModel, _args, _context: Context) => {
      return parent.getFuelType();
    },
    salesTickets: async (parent: DispenserModel, _args, _context: Context) => {
      return parent.getSalesTickets();
    },
  },
};

export default dispenserResolver;
