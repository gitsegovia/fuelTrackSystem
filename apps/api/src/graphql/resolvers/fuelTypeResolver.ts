import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { FuelType as FuelTypeModel } from "../../models/fuelType"; // Importar el tipo de modelo FuelType

const fuelTypeResolver: IResolvers<Context> = {
  Query: {
    // Obtener todos los tipos de combustible
    fuelTypes: async (_parent, _args, context: Context) => {
      return context.models.FuelType.findAll({
        // Incluir relaciones si se necesitan por defecto
        include: [
          // { model: context.models.SaleTypeConfig, as: 'saleTypeConfigs' }, // Descomentar cuando SaleTypeConfig esté listo
          // { model: context.models.Tank, as: 'tanksStoringThisFuel' }, // Descomentar cuando Tank esté listo
          // { model: context.models.Dispenser, as: 'dispensersHandlingThisFuel' }, // Descomentar cuando Dispenser esté listo
          // { model: context.models.SalesTicket, as: 'salesTicketsForFuel' }, // Descomentar cuando SalesTicket esté listo
        ],
      });
    },
    // Obtener un tipo de combustible por ID
    fuelType: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.FuelType.findByPk(id, {
        include: [
          // { model: context.models.SaleTypeConfig, as: 'saleTypeConfigs' },
          // { model: context.models.Tank, as: 'tanksStoringThisFuel' },
          // { model: context.models.Dispenser, as: 'dispensersHandlingThisFuel' },
          // { model: context.models.SalesTicket, as: 'salesTicketsForFuel' },
        ],
      });
    },
  },
  Mutation: {
    // Crear un nuevo tipo de combustible
    createFuelType: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const fuelType = await context.models.FuelType.create(input, {
            transaction: t,
          });
          return fuelType;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createFuelType' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Fuel type name already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while creating the fuel type: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar un tipo de combustible existente
    updateFuelType: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const fuelType = await context.models.FuelType.findByPk(id, {
            transaction: t,
          });
          if (!fuelType) {
            throw new Error("Fuel type not found.");
          }
          await fuelType.update(input, { transaction: t });
          return fuelType;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateFuelType' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Fuel type name already exists. Please choose another one."
          );
        }
        throw new Error(
          `An error occurred while updating the fuel type: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar un tipo de combustible
    deleteFuelType: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.FuelType.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteFuelType' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the fuel type: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  // FuelType: {
  //   saleTypeConfig: async (parent: FuelTypeModel, _args, _context: Context) => {
  //     return parent.getSaleTypeConfig();
  //   },
  //   tanksStoringThisFuel: async (
  //     parent: FuelTypeModel,
  //     _args,
  //     _context: Context
  //   ) => {
  //     return parent.getTanksStoringThisFuel();
  //   },
  //   dispensersHandlingThisFuel: async (
  //     parent: FuelTypeModel,
  //     _args,
  //     _context: Context
  //   ) => {
  //     return parent.getDispensersHandlingThisFuel();
  //   },
  //   salesTicketsForFuel: async (
  //     parent: FuelTypeModel,
  //     _args,
  //     _context: Context
  //   ) => {
  //     return parent.getSalesTicketsForFuel();
  //   },
  // },
};

export default fuelTypeResolver;
