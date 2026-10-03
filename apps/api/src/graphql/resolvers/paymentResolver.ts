import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { PaymentMethod, PaymentMode, SalesTicketStatus } from "../../utils/types"; // Importar ENUMS
import { belongsTo } from "../helpers/dataloaders";
import {
  MONEY_EPSILON,
  ticketPaymentCoverage,
} from "../helpers/ticketFinancials";

const assertPaymentAllowed = (salesTicket: { status: string; paymentMode: string }) => {
  if (salesTicket.status === SalesTicketStatus.CANCELED) {
    throw new Error(`Cannot add payment to a ticket with status: ${salesTicket.status}.`);
  }
  if (salesTicket.paymentMode === PaymentMode.PREPAID && salesTicket.status !== SalesTicketStatus.ISSUED) {
    throw new Error(
      `Prepaid sales ticket accepts payment only while ISSUED (current status: ${salesTicket.status}).`
    );
  }
  if (salesTicket.paymentMode === PaymentMode.POSTPAID && salesTicket.status !== SalesTicketStatus.DISPATCHED) {
    throw new Error(
      `Postpaid sales ticket accepts payment only after dispatch (current status: ${salesTicket.status}).`
    );
  }
};

const settleIfCovered = async (
  context: Context,
  salesTicket: { id: string; paymentMode: string; update: (values: object, options: object) => Promise<unknown> },
  transaction: any
) => {
  const { paidBase, dueBase } = await ticketPaymentCoverage(context, salesTicket.id, transaction);
  if (paidBase + MONEY_EPSILON < dueBase) return;
  const status =
    salesTicket.paymentMode === PaymentMode.PREPAID
      ? SalesTicketStatus.PAID
      : SalesTicketStatus.COMPLETED;
  await salesTicket.update({ status }, { transaction });
};

const assertPaymentsEditable = (salesTicket: { status: string } | null) => {
  if (
    salesTicket &&
    (salesTicket.status === SalesTicketStatus.PAID || salesTicket.status === SalesTicketStatus.COMPLETED)
  ) {
    throw new Error(
      `Cannot modify payments of a sales ticket with status: ${salesTicket.status}.`
    );
  }
};

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
            { transaction: t, lock: t.LOCK.UPDATE }
          );
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          assertPaymentAllowed(salesTicket);

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

          await settleIfCovered(context, salesTicket, t);
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
            { transaction: t, lock: t.LOCK.UPDATE }
          );
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          assertPaymentAllowed(salesTicket);
          if (payments.length === 0) {
            throw new Error("At least one payment line is required.");
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

          await settleIfCovered(context, salesTicket, t);
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

          assertPaymentsEditable(await payment.getSalesTicket({ transaction: t }));

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

          assertPaymentsEditable(await payment.getSalesTicket({ transaction: t }));

          const deleted = await context.models.Payment.destroy({
            where: { id },
            transaction: t,
          });
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
    salesTicket: belongsTo("salesTicket", "SalesTicket", "salesTicketId"),
    currency: belongsTo("currency", "Currency", "currencyId"),
  },
};

export default paymentResolver;
