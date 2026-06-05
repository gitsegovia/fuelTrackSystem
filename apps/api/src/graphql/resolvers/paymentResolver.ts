import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { Payment as PaymentModel } from "../../models/payment";
import { PaymentMethod, SalesTicketStatus } from "../../utils/types"; // Importar ENUMS

const paymentResolver: IResolvers<Context> = {
  Query: {
    payments: async (_parent, _args, context: Context) => {
      return context.models.Payment.findAll({
        include: [
          { model: context.models.SalesTicket, as: "salesTicket" },
          { model: context.models.Currency, as: "currency" },
        ],
      });
    },
    payment: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Payment.findByPk(id, {
        include: [
          { model: context.models.SalesTicket, as: "salesTicket" },
          { model: context.models.Currency, as: "currency" },
        ],
      });
    },
    paymentsBySalesTicket: async (
      _parent,
      { salesTicketId }: { salesTicketId: string },
      context: Context
    ) => {
      return context.models.Payment.findAll({
        where: { salesTicketId },
        include: [
          { model: context.models.SalesTicket, as: "salesTicket" },
          { model: context.models.Currency, as: "currency" },
        ],
        order: [["paymentTime", "ASC"]],
      });
    },
    paymentsByMethod: async (
      _parent,
      { paymentMethod }: { paymentMethod: PaymentMethod },
      context: Context
    ) => {
      return context.models.Payment.findAll({
        where: { paymentMethod },
        include: [
          { model: context.models.SalesTicket, as: "salesTicket" },
          { model: context.models.Currency, as: "currency" },
        ],
      });
    },
    paymentsByCurrency: async (
      _parent,
      { currencyId }: { currencyId: string },
      context: Context
    ) => {
      return context.models.Payment.findAll({
        where: { currencyId },
        include: [
          { model: context.models.SalesTicket, as: "salesTicket" },
          { model: context.models.Currency, as: "currency" },
        ],
      });
    },
  },
  Mutation: {
    createPayment: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(
            input.salesTicketId,
            { transaction: t }
          );
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }

          // Validación adicional: no permitir pagos si el ticket está cancelado o reembolsado
          if (salesTicket.status === SalesTicketStatus.CANCELED) {
            throw new Error(
              `Cannot add payment to a ticket with status: ${salesTicket.status}.`
            );
          }

          const paymentCurrency = await context.models.Currency.findByPk(
            input.currencyId,
            { transaction: t }
          );
          if (!paymentCurrency) {
            throw new Error(`Currency not found: ${input.currencyId}`);
          }

          const payment = await context.models.Payment.create(
            { ...input, exchangeRateAtPayment: paymentCurrency.exchangeRate },
            { transaction: t }
          );

          // Opcional: Actualizar el estado del SalesTicket a COMPLETED si la suma de pagos cubre el total esperado.
          // Esto se podría hacer también en una mutación separada `completeSalesTicketPayment`.
          // Si se prefiere hacer aquí, se necesita obtener todos los pagos del ticket y sumarlos.
          const paymentsForTicket = await context.models.Payment.findAll({
            where: { salesTicketId: input.salesTicketId },
            transaction: t,
          });

          // Obtener la moneda del SaleTypeConfig para saber en qué moneda está totalAmountExpected
          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            salesTicket.assignedSaleTypeConfigId,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type config not found for this ticket.");
          }
          const ticketCurrency = await saleTypeConfig.getCurrency({
            transaction: t,
          });
          if (!ticketCurrency) {
            throw new Error("Currency not found for sale type config.");
          }

          // Convertir totalAmountExpected a moneda base: amount / exchangeRate = monto base
          const totalExpectedInBase =
            parseFloat(String(salesTicket.totalAmountExpected)) /
            ticketCurrency.exchangeRate;

          // Calcular el total pagado en moneda base sumando cada pago con su propia tasa
          let totalPaidInBaseCurrency = 0;
          for (const p of paymentsForTicket) {
            const currencyOfPayment = await p.getCurrency({ transaction: t });
            if (!currencyOfPayment) {
              throw new Error(`Currency not found for payment ${p.id}`);
            }
            totalPaidInBaseCurrency +=
              parseFloat(String(p.amount)) / currencyOfPayment.exchangeRate;
          }

          if (totalPaidInBaseCurrency >= totalExpectedInBase) {
            await salesTicket.update(
              { status: SalesTicketStatus.COMPLETED },
              { transaction: t }
            );
          }

          return payment;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createPayment' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the payment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    createPayments: async (
      _parent,
      {
        salesTicketId,
        paymentTime,
        payments,
      }: {
        salesTicketId: string;
        paymentTime: Date;
        payments: Array<{
          paymentMethod: string;
          amount: number;
          currencyId: string;
          transactionReference?: string;
        }>;
      },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(
            salesTicketId,
            { transaction: t }
          );
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          if (salesTicket.status === SalesTicketStatus.CANCELED) {
            throw new Error(
              `Cannot add payments to a ticket with status: ${salesTicket.status}.`
            );
          }

          // Crear cada línea de pago capturando el snapshot de la tasa
          const createdPayments = [];
          for (const line of payments) {
            const currency = await context.models.Currency.findByPk(
              line.currencyId,
              { transaction: t }
            );
            if (!currency) {
              throw new Error(`Currency not found: ${line.currencyId}`);
            }
            const payment = await context.models.Payment.create(
              {
                salesTicketId,
                paymentMethod: line.paymentMethod as any,
                amount: line.amount,
                currencyId: line.currencyId,
                paymentTime,
                transactionReference: line.transactionReference,
                exchangeRateAtPayment: currency.exchangeRate,
              },
              { transaction: t }
            );
            createdPayments.push(payment);
          }

          // Verificar si el total pagado cubre el monto esperado del ticket
          const allPayments = await context.models.Payment.findAll({
            where: { salesTicketId },
            transaction: t,
          });

          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            salesTicket.assignedSaleTypeConfigId,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type config not found for this ticket.");
          }
          const ticketCurrency = await saleTypeConfig.getCurrency({
            transaction: t,
          });
          if (!ticketCurrency) {
            throw new Error("Currency not found for sale type config.");
          }

          const totalExpectedInBase =
            parseFloat(String(salesTicket.totalAmountExpected)) /
            ticketCurrency.exchangeRate;

          // Usar el snapshot guardado en cada pago para la suma (no la tasa actual)
          let totalPaidInBase = 0;
          for (const p of allPayments) {
            totalPaidInBase +=
              parseFloat(String(p.amount)) /
              parseFloat(String(p.exchangeRateAtPayment));
          }

          if (totalPaidInBase >= totalExpectedInBase) {
            await salesTicket.update(
              { status: SalesTicketStatus.COMPLETED },
              { transaction: t }
            );
          }

          return createdPayments;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createPayments' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating payments: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    updatePayment: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const payment = await context.models.Payment.findByPk(id, {
            transaction: t,
          });
          if (!payment) {
            throw new Error("Payment not found.");
          }

          // Aquí se podría añadir lógica para verificar si el SalesTicket asociado
          // ya está en estado 'COMPLETED' o 'REFUNDED' y no debería permitirse actualizar el pago.
          const salesTicket = await payment.getSalesTicket({ transaction: t });
          if (
            salesTicket &&
            salesTicket.status === SalesTicketStatus.COMPLETED
          ) {
            throw new Error(
              "Cannot update payment for a completed or refunded sales ticket."
            );
          }

          await payment.update(input, { transaction: t });
          return payment;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updatePayment' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while updating the payment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    deletePayment: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const payment = await context.models.Payment.findByPk(id, {
            transaction: t,
          });
          if (!payment) {
            throw new Error("Payment not found.");
          }

          const salesTicket = await payment.getSalesTicket({ transaction: t });
          if (
            salesTicket &&
            salesTicket.status === SalesTicketStatus.COMPLETED
          ) {
            throw new Error(
              "Cannot delete payment for a completed or refunded sales ticket."
            );
          }

          const deleted = await context.models.Payment.destroy({
            where: { id },
            transaction: t,
          });

          // Opcional: Revertir el estado del SalesTicket si la suma de pagos ya no cubre el total
          // Esto requeriría volver a calcular el total de pagos para el salesTicketId de `payment`
          // y actualizar su estado si es necesario.
          // Por ejemplo:
          // if (salesTicket) {
          //   const remainingPayments = await context.models.Payment.findAll({
          //     where: { salesTicketId: salesTicket.id },
          //     transaction: t,
          //   });
          //   const totalRemainingPaid = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
          //   if (totalRemainingPaid < salesTicket.totalAmountExpected && salesTicket.status === SalesTicketStatus.COMPLETED) {
          //     await salesTicket.update({ status: SalesTicketStatus.DISPATCHED_PENDING_PAYMENT }, { transaction: t });
          //   }
          // }

          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deletePayment' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the payment: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  Payment: {
    salesTicket: async (parent: PaymentModel, _args, _context: Context) => {
      return parent.getSalesTicket();
    },
    currency: async (parent: PaymentModel, _args, _context: Context) => {
      return parent.getCurrency();
    },
  },
};

export default paymentResolver;
