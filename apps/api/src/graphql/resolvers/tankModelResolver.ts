import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { TankModel as TankModelModel } from "../../models/tankModel"; // Importar el tipo de modelo TankModel

const tankModelResolver: IResolvers<Context> = {
  Query: {
    // Obtener todos los modelos de tanque
    tankModels: async (_parent, _args, context: Context) => {
      return context.models.TankModel.findAll({
        include: [
          // { model: context.models.TankCalibrationEntry, as: 'calibrationEntries' }, // Descomentar cuando TankCalibrationEntry esté listo
          // { model: context.models.Tank, as: 'tanks' }, // Descomentar cuando Tank esté listo
        ],
      });
    },
    // Obtener un modelo de tanque por ID
    tankModel: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.TankModel.findByPk(id, {
        include: [
          // { model: context.models.TankCalibrationEntry, as: 'calibrationEntries' },
          // { model: context.models.Tank, as: 'tanks' },
        ],
      });
    },
  },
  Mutation: {
    // Crear un nuevo modelo de tanque
    createTankModel: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tankModel = await context.models.TankModel.create(input, {
            transaction: t,
          });
          return tankModel;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTankModel' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Tank model name already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while creating the tank model: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar un modelo de tanque existente
    updateTankModel: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tankModel = await context.models.TankModel.findByPk(id, {
            transaction: t,
          });
          if (!tankModel) {
            throw new Error("Tank model not found.");
          }
          await tankModel.update(input, { transaction: t });
          return tankModel;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateTankModel' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Tank model name already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while updating the tank model: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar un modelo de tanque
    deleteTankModel: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.TankModel.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteTankModel' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the tank model: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  TankModel: {
    calibrationEntries: async (
      parent: TankModelModel,
      _args,
      _context: Context
    ) => {
      return parent.getCalibrationEntries();
    },
    tanks: async (parent: TankModelModel, _args, _context: Context) => {
      return parent.getTanks();
    },
  },
};

export default tankModelResolver;
