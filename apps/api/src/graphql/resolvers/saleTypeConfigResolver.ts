import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { SaleTypeConfig as SaleTypeConfigModel } from "../../models/saleTypeConfig"; // Importar el tipo de modelo SaleTypeConfig

const saleTypeConfigResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las configuraciones de tipo de venta
    saleTypeConfigs: async (_parent, _args, context: Context) => {
      return context.models.SaleTypeConfig.findAll({
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.Currency, as: "currency" },
          // { model: context.models.SalesTicket, as: 'associatedSalesTickets' }, // Descomentar cuando SalesTicket esté listo
        ],
      });
    },
    // Obtener una configuración por ID
    saleTypeConfig: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.SaleTypeConfig.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.Currency, as: "currency" },
          // { model: context.models.SalesTicket, as: 'associatedSalesTickets' },
        ],
      });
    },
    // Obtener una configuración por estación, tipo de combustible y nombre de venta (usando el índice único)
    saleTypeConfigByStationFuelTypeAndName: async (
      _parent,
      {
        gasStationId,
        fuelTypeId,
        saleTypeName,
      }: { gasStationId: string; fuelTypeId: string; saleTypeName: string },
      context: Context
    ) => {
      return context.models.SaleTypeConfig.findOne({
        where: {
          gasStationId,
          fuelTypeId,
          saleTypeName,
        },
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.FuelType, as: "fuelType" },
          { model: context.models.Currency, as: "currency" },
        ],
      });
    },
  },
  Mutation: {
    // Crear una nueva configuración de tipo de venta
    createSaleTypeConfig: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const saleTypeConfig = await context.models.SaleTypeConfig.create(
            input,
            { transaction: t }
          );
          return saleTypeConfig;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createSaleTypeConfig' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A sale type configuration with this station, fuel type, and name already exists."
          );
        }
        throw new Error(
          `An error occurred while creating the sale type configuration: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una configuración existente
    updateSaleTypeConfig: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            id,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type configuration not found.");
          }
          await saleTypeConfig.update(input, { transaction: t });
          return saleTypeConfig;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateSaleTypeConfig' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to this configuration would create a duplicate with another existing entry."
          );
        }
        throw new Error(
          `An error occurred while updating the sale type configuration: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una configuración
    deleteSaleTypeConfig: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.SaleTypeConfig.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteSaleTypeConfig' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the sale type configuration: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  SaleTypeConfig: {
    gasStation: async (
      parent: SaleTypeConfigModel,
      _args,
      _context: Context
    ) => {
      return parent.getGasStation();
    },
    fuelType: async (parent: SaleTypeConfigModel, _args, _context: Context) => {
      return parent.getFuelType();
    },
    currency: async (parent: SaleTypeConfigModel, _args, _context: Context) => {
      return parent.getCurrency();
    },
    associatedSalesTickets: async (
      parent: SaleTypeConfigModel,
      _args,
      _context: Context
    ) => {
      // Necesitarás SalesTicket definido para esto
      return parent.getAssociatedSalesTickets();
    },
  },
};

export default saleTypeConfigResolver;
