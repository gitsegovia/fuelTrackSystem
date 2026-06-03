import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { TankCalibrationEntry as TankCalibrationEntryModel } from "../../models/tankCalibrationEntry";

const tankCalibrationEntryResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las entradas de calibración de tanques
    tankCalibrationEntries: async (_parent, _args, context: Context) => {
      return context.models.TankCalibrationEntry.findAll({
        include: [{ model: context.models.TankModel, as: "tankModel" }],
      });
    },
    // Obtener una entrada de calibración por ID
    tankCalibrationEntry: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.TankCalibrationEntry.findByPk(id, {
        include: [{ model: context.models.TankModel, as: "tankModel" }],
      });
    },
    // Obtener una entrada de calibración por modelo de tanque y altura (usando el índice único)
    tankCalibrationEntryByModelAndHeight: async (
      _parent,
      { tankModelId, heightCm }: { tankModelId: string; heightCm: number },
      context: Context
    ) => {
      return context.models.TankCalibrationEntry.findOne({
        where: {
          tankModelId,
          heightCm,
        },
        include: [{ model: context.models.TankModel, as: "tankModel" }],
      });
    },
  },
  Mutation: {
    // Crear una nueva entrada de calibración
    createTankCalibrationEntry: async (
      _parent,
      { input },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const entry = await context.models.TankCalibrationEntry.create(
            input,
            { transaction: t }
          );
          return entry;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTankCalibrationEntry' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A calibration entry for this tank model and height already exists."
          );
        }
        throw new Error(
          `An error occurred while creating the tank calibration entry: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una entrada de calibración existente
    updateTankCalibrationEntry: async (
      _parent,
      { id, input },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const entry = await context.models.TankCalibrationEntry.findByPk(id, {
            transaction: t,
          });
          if (!entry) {
            throw new Error("Tank calibration entry not found.");
          }
          await entry.update(input, { transaction: t });
          return entry;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateTankCalibrationEntry' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to this entry would create a duplicate for this tank model and height."
          );
        }
        throw new Error(
          `An error occurred while updating the tank calibration entry: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una entrada de calibración
    deleteTankCalibrationEntry: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.TankCalibrationEntry.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteTankCalibrationEntry' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the tank calibration entry: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  TankCalibrationEntry: {
    tankModel: async (
      parent: TankCalibrationEntryModel,
      _args,
      _context: Context
    ) => {
      return parent.getTankModel();
    },
  },
};

export default tankCalibrationEntryResolver;
