import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { SalesTicketStatus } from "../../utils/types";
import { toNum } from "../helpers/auditHelpers";
import {
  MONEY_EPSILON,
  computeTicketFinancials,
  loadTicketFinancialRows,
} from "../helpers/ticketFinancials";
import { belongsTo } from "../helpers/dataloaders";

const ticketRefundResolver: IResolvers<Context> = {
  Query: {
    ticketRefundsBySalesTicket: async (
      _parent,
      { salesTicketId }: { salesTicketId: string },
      context: Context
    ) => {
      return context.models.TicketRefund.findAll({
        where: { salesTicketId },
        order: [["refundedAt", "ASC"]],
      });
    },
  },
  Mutation: {
    createTicketRefund: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(
            input.salesTicketId,
            { transaction: t, lock: t.LOCK.UPDATE }
          );
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          if (salesTicket.status !== SalesTicketStatus.COMPLETED) {
            throw new Error(
              `Only COMPLETED sales tickets can be refunded (current status: ${salesTicket.status}).`
            );
          }

          const amount = toNum(input.amount);
          if (!(amount > 0)) {
            throw new Error("Refund amount must be greater than zero.");
          }

          const currency = await context.models.Currency.findByPk(input.currencyId, {
            transaction: t,
          });
          if (!currency) {
            throw new Error(`Currency not found: ${input.currencyId}`);
          }

          const [row] = await loadTicketFinancialRows(
            context,
            `st.id = :ticketId`,
            { ticketId: input.salesTicketId },
            t
          );
          const { remainingBase } = computeTicketFinancials(row);
          if (remainingBase <= MONEY_EPSILON) {
            throw new Error("The sales ticket has no differential pending refund.");
          }

          const refundBase = amount / toNum(currency.exchangeRate);
          if (refundBase > remainingBase + MONEY_EPSILON) {
            throw new Error(
              `Refund exceeds the pending differential: ${remainingBase.toFixed(2)} in base currency.`
            );
          }

          return context.models.TicketRefund.create(
            {
              salesTicketId: input.salesTicketId,
              amount,
              currencyId: input.currencyId,
              exchangeRateAtRefund: currency.exchangeRate,
              paymentMethod: input.paymentMethod,
              recordedById: input.recordedById,
              refundedAt: input.refundedAt,
              notes: input.notes,
            },
            { transaction: t }
          );
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTicketRefund' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the ticket refund: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  TicketRefund: {
    salesTicket: belongsTo("salesTicket", "SalesTicket", "salesTicketId"),
    currency: belongsTo("currency", "Currency", "currencyId"),
    recordedBy: belongsTo("recordedBy", "User", "recordedById"),
  },
};

export default ticketRefundResolver;
