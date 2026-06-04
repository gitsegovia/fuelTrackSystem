import { gql } from '@apollo/client'

const PAYMENT_FRAGMENT = gql`
  fragment PaymentFields on Payment {
    id
    salesTicketId
    paymentMethod
    amount
    paymentTime
    transactionReference
    currencyId
    createdAt
    currency { id name symbol }
  }
`

export const QUERIES = {
  paymentsBySalesTicket: gql`
    query PaymentsBySalesTicket($salesTicketId: UUID!) {
      paymentsBySalesTicket(salesTicketId: $salesTicketId) { ...PaymentFields }
    } ${PAYMENT_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createPayment: gql`
    mutation CreatePayment($input: CreatePaymentInput!) {
      createPayment(input: $input) { ...PaymentFields }
    } ${PAYMENT_FRAGMENT}
  `,
  deletePayment: gql`
    mutation DeletePayment($id: UUID!) { deletePayment(id: $id) }
  `,
}
