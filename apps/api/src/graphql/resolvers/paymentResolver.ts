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

          const payment = await context.models.Payment.create(input, {
            transaction: t,
          });

          // Opcional: Actualizar el estado del SalesTicket a COMPLETED si la suma de pagos cubre el total esperado.
          // Esto se podría hacer también en una mutación separada `completeSalesTicketPayment`.
          // Si se prefiere hacer aquí, se necesita obtener todos los pagos del ticket y sumarlos.
          const paymentsForTicket = await context.models.Payment.findAll({
            where: { salesTicketId: input.salesTicketId },
            transaction: t,
          });

          // Calcular el total pagado, considerando la tasa de cambio de cada moneda
          let totalPaidInBaseCurrency = 0; // Asumiendo que tenemos una moneda base, ej. USD
          const baseCurrency = await context.models.Currency.findOne({
            where: { name: "USD" },
            transaction: t,
          }); // O la moneda base que definas

          for (const p of paymentsForTicket) {
            const currencyOfPayment = await p.getCurrency({ transaction: t });
            if (!currencyOfPayment) {
              throw new Error(`Currency not found for payment ${p.id}`);
            }
            // Convertir el monto del pago a la moneda base
            // Si la moneda base es 'USD' y la moneda del pago es 'VES' con exchangeRate 36.5 VES/USD,
            // entonces p.amount (en VES) / 36.5 = monto en USD
            const amountInBase = p.amount / currencyOfPayment.exchangeRate;
            totalPaidInBaseCurrency += amountInBase;
          }

          // Convertir el totalAmountExpected del ticket a la moneda base para la comparación
          // Esto requeriría que SalesTicket también tenga un currencyId o que totalAmountExpected siempre esté en moneda base
          // Por simplicidad aquí, asumiremos que totalAmountExpected está en la moneda base.
          // Si salesTicket.totalAmountExpected está en una moneda específica, también se debe convertir.
          // Por ejemplo: salesTicket.assignedSaleTypeConfig.getCurrency() -> currencyForTicket -> salesTicket.totalAmountExpected / currencyForTicket.exchangeRate

          // Simplemente como ejemplo, sin conversión compleja:
          if (
            totalPaidInBaseCurrency >=
            salesTicket.totalAmountExpected / (baseCurrency?.exchangeRate || 1)
          ) {
            // Asume totalAmountExpected en moneda base o se convierte
            await salesTicket.update(
              { status: SalesTicketStatus.COMPLETED },
              { transaction: t }
            );
          } else {
            // Si el ticket estaba PENDING_PAYMENT_DISPATCH y se recibió un pago, podría pasar a DISPATCHED_PENDING_PAYMENT
            // o mantener el mismo si aún se espera más, dependiendo del flujo de negocio.
            // Aquí lo dejamos como está si no se completa.
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
