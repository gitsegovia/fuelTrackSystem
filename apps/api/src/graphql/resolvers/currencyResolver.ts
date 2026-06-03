// src/graphql/resolvers/currencyResolver.ts

import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { AppModels } from "../../interfaces/models";
// Importar el tipo de modelo Currency para tipar el 'parent' en los resolvers de campo
import { Currency as CurrencyModel } from "../../models/currency";

const currencyResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las monedas
    currencies: async (_parent, _args, context: Context) => {
      // Incluimos las relaciones si queremos que se resuelvan con la consulta principal
      return context.models.Currency.findAll({
        // include: [
        //   { model: context.models.SaleTypeConfig, as: 'saleTypeConfigs' },
        //   { model: context.models.Invoice, as: 'invoices' },
        //   { model: context.models.DispatchReception, as: 'dispatchReceptions' },
        //   { model: context.models.Payment, as: 'payments' },
        // ],
      });
    },
    // Obtener una moneda por ID
    currency: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Currency.findByPk(id, {
        // include: [
        //   { model: context.models.SaleTypeConfig, as: 'saleTypeConfigs' },
        //   { model: context.models.Invoice, as: 'invoices' },
        //   { model: context.models.DispatchReception, as: 'dispatchReceptions' },
        //   { model: context.models.Payment, as: 'payments' },
        // ],
      });
    },
  },
  Mutation: {
    // Crear una nueva moneda
    createCurrency: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t) => {
          const currency = await context.models.Currency.create(input, {
            transaction: t,
          });
          return currency;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'createCurrency':`,
          error.message || error
        );
        throw new Error(
          `Ha ocurrido un error al crear la moneda: ${
            error.message || "Error desconocido"
          }`
        );
      }
    },
    // Actualizar una moneda existente
    updateCurrency: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t) => {
          const currency = await context.models.Currency.findByPk(id, {
            transaction: t,
          });
          if (!currency) {
            throw new Error("Currency not found.");
          }
          await currency.update(input, { transaction: t });
          return currency;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'updateCurrency':`,
          error.message || error
        );
        throw new Error(
          `Ha ocurrido un error al actualizar la moneda: ${
            error.message || "Error desconocido"
          }`
        );
      }
    },
    // Eliminar una moneda
    deleteCurrency: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t) => {
          const deleted = await context.models.Currency.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error en la mutación 'deleteCurrency':`,
          error.message || error
        );
        throw new Error(
          `Ha ocurrido un error al eliminar la moneda: ${
            error.message || "Error desconocido"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones inversas ---
  Currency: {
    saleTypeConfigs: async (
      parent: CurrencyModel,
      _args,
      _context: Context
    ) => {
      return parent.getSaleTypeConfigs();
    },
    invoices: async (parent: CurrencyModel, _args, _context: Context) => {
      return parent.getInvoices();
    },
    dispatchReceptions: async (
      parent: CurrencyModel,
      _args,
      _context: Context
    ) => {
      return parent.getDispatchReceptions();
    },
    payments: async (parent: CurrencyModel, _args, _context: Context) => {
      return parent.getPayments();
    },
  },
};

export default currencyResolver;
