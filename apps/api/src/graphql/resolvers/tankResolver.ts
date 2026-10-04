import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Tank as TankModel } from "../../models/tank"; // Import the Tank model type
import { belongsTo, hasMany } from "../helpers/dataloaders";

const tankResolver: IResolvers<Context> = {
  Query: {
    // Get all tanks
    tanks: async (_parent, _args, context: Context) => {
      // H-021 (T-022, riesgo #7): measurements/dispatchReceptions (hasMany sin límite) fuera del
      // include base. Si el cliente los pide anidados, los sirve el field resolver de abajo
      // (parent.getX()), igual que hoy — no había ganancia real en incluirlos aquí porque
      // graphql-js siempre invoca el field resolver explícito en vez de leer la propiedad ya
      // cargada por Sequelize.
      return context.models.Tank.findAll({
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.TankModel, as: "tankModel" },
          { model: context.models.TankAssignment, as: "tankAssignments" },
          { model: context.models.Dispenser, as: "connectedDispensers" },
        ],
      });
    },
    // Get a tank by ID
    tank: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Tank.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.TankModel, as: "tankModel" },
          { model: context.models.TankAssignment, as: "tankAssignments" },
          { model: context.models.Dispenser, as: "connectedDispensers" },
        ],
      });
    },
    // Get tanks by gas station ID
    tanksByGasStation: async (
      _parent,
      { gasStationId }: { gasStationId: string },
      context: Context
    ) => {
      return context.models.Tank.findAll({
        where: { gasStationId },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.TankModel, as: "tankModel" },
        ],
      });
    },
    // Get a tank by gas station ID and name (using the unique index)
    tankByGasStationAndName: async (
      _parent,
      { gasStationId, name }: { gasStationId: string; name: string },
      context: Context
    ) => {
      return context.models.Tank.findOne({
        where: {
          gasStationId,
          name,
        },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.TankModel, as: "tankModel" },
        ],
      });
    },
  },
  Mutation: {
    // Create a new tank
    createTank: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tank = await context.models.Tank.create(input, {
            transaction: t,
          });
          return tank;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTank' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A tank with this name already exists for this gas station. Please choose another name."
          );
        }
        throw new Error(
          `An error occurred while creating the tank: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Update an existing tank
    updateTank: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tank = await context.models.Tank.findByPk(id, {
            transaction: t,
          });
          if (!tank) {
            throw new Error("Tank not found.");
          }
          await tank.update(input, { transaction: t });
          return tank;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateTank' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to this tank name would create a duplicate for this gas station."
          );
        }
        throw new Error(
          `An error occurred while updating the tank: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Delete a tank
    deleteTank: async (_parent, { id }: { id: string }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.Tank.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteTank' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the tank: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Field Resolvers for relationships ---
  Tank: {
    gasStation: belongsTo("gasStation", "GasStation", "gasStationId"),
    fuelType: belongsTo("fuelType", "FuelType", "fuelTypeId"),
    tankModel: belongsTo("tankModel", "TankModel", "tankModelId"),
    // tankId en tank_assignments es una columna fantasma (H-016): nadie la setea, siempre []
    tankAssignments: hasMany("tankAssignments", "TankAssignment", "tankId"),
    connectedDispensers: hasMany("connectedDispensers", "Dispenser", "tankId"),
    dispatchReceptions: hasMany("dispatchReceptions", "DispatchReception", "tankId"),
    measurements: hasMany("measurements", "TankMeasurement", "tankId"),
  },
};

export default tankResolver;
