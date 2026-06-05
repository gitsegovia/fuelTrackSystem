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
    exchangeRateAtPayment
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
  createPayments: gql`
    mutation CreatePayments($salesTicketId: UUID!, $paymentTime: DateTime!, $payments: [PaymentLineInput!]!) {
      createPayments(salesTicketId: $salesTicketId, paymentTime: $paymentTime, payments: $payments) { ...PaymentFields }
    } ${PAYMENT_FRAGMENT}
  `,
  deletePayment: gql`
    mutation DeletePayment($id: UUID!) { deletePayment(id: $id) }
  `,
}
