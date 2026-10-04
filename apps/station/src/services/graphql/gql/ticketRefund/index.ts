import { gql } from '@apollo/client'

const TICKET_REFUND_FRAGMENT = gql`
  fragment TicketRefundFields on TicketRefund {
    id
    salesTicketId
    amount
    currencyId
    exchangeRateAtRefund
    paymentMethod
    refundedAt
    notes
    currency { id name symbol }
  }
`

export const QUERIES = {
  ticketRefundsBySalesTicket: gql`
    query TicketRefundsBySalesTicket($salesTicketId: UUID!) {
      ticketRefundsBySalesTicket(salesTicketId: $salesTicketId) { ...TicketRefundFields }
    } ${TICKET_REFUND_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createTicketRefund: gql`
    mutation CreateTicketRefund($input: CreateTicketRefundInput!) {
      createTicketRefund(input: $input) { ...TicketRefundFields }
    } ${TICKET_REFUND_FRAGMENT}
  `,
}
