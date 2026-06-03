import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { TankAssignment as TankAssignmentModel } from "../../models/tankAssignment"; // Importar el tipo de modelo

const tankAssignmentResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las asignaciones de tanque
    tankAssignments: async (_parent, _args, context: Context) => {
      return context.models.TankAssignment.findAll({
        include: [
          { model: context.models.DispatchReception, as: "dispatchReception" },
        ],
      });
    },
    // Obtener una asignación de tanque por ID
    tankAssignment: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.TankAssignment.findByPk(id, {
        include: [
          { model: context.models.DispatchReception, as: "dispatchReception" },
        ],
      });
    },
    // Obtener asignaciones de tanque por ID de recepción de despacho
    tankAssignmentsByDispatchReception: async (
      _parent,
      { dispatchReceptionId }: { dispatchReceptionId: string },
      context: Context
    ) => {
      return context.models.TankAssignment.findAll({
        where: { dispatchReceptionId },
        include: [
          { model: context.models.DispatchReception, as: "dispatchReception" },
        ],
      });
    },
    // Obtener una asignación de tanque por recepción de despacho y fecha
    tankAssignmentByDispatchReceptionAndDate: async (
      _parent,
      {
        dispatchReceptionId,
        assignedDate,
      }: { dispatchReceptionId: string; assignedDate: Date },
      context: Context
    ) => {
      return context.models.TankAssignment.findOne({
        where: {
          dispatchReceptionId,
          assignedDate,
        },
        include: [
          { model: context.models.DispatchReception, as: "dispatchReception" },
        ],
      });
    },
  },
  Mutation: {
    // Crear una nueva asignación de tanque
    createTankAssignment: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tankAssignment = await context.models.TankAssignment.create(
            input,
            { transaction: t }
          );
          return tankAssignment;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTankAssignment' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A tank assignment for this dispatch reception and date already exists."
          );
        }
        throw new Error(
          `An error occurred while creating the tank assignment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una asignación de tanque existente
    updateTankAssignment: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const tankAssignment = await context.models.TankAssignment.findByPk(
            id,
            { transaction: t }
          );
          if (!tankAssignment) {
            throw new Error("Tank assignment not found.");
          }
          await tankAssignment.update(input, { transaction: t });
          return tankAssignment;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateTankAssignment' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate for this dispatch reception and date."
          );
        }
        throw new Error(
          `An error occurred while updating the tank assignment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una asignación de tanque
    deleteTankAssignment: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.TankAssignment.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteTankAssignment' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the tank assignment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  TankAssignment: {
    dispatchReception: async (
      parent: TankAssignmentModel,
      _args,
      _context: Context
    ) => {
      return parent.getDispatchReception();
    },
  },
};

export default tankAssignmentResolver;
