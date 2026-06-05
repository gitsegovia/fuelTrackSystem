import { gql } from '@apollo/client'

const INVOICE_PAYMENT_FRAGMENT = gql`
  fragment InvoicePaymentFields on InvoicePayment {
    id
    invoiceId
    amount
    paymentDate
    bankName
    paymentMethod
    referenceNumber
    notes
    createdAt
    updatedAt
    recordedBy { id username }
  }
`

const INVOICE_BALANCE_FRAGMENT = gql`
  fragment InvoiceBalanceFields on InvoiceBalance {
    totalAmount
    totalPaid
    balance
    paymentStatus
    invoice {
      id invoiceNumber controlNumber fuelKind
      totalAmount costPerLiter liters
      dispatchDate status
      receivingGasStation { id name }
      currency { id name symbol }
    }
    payments { ...InvoicePaymentFields }
  }
  ${INVOICE_PAYMENT_FRAGMENT}
`

export const QUERIES = {
  invoicePayment: gql`
    query InvoicePayment($id: UUID!) {
      invoicePayment(id: $id) { ...InvoicePaymentFields }
    } ${INVOICE_PAYMENT_FRAGMENT}
  `,

  invoicePayments: gql`
    query InvoicePayments($invoiceId: UUID!) {
      invoicePayments(invoiceId: $invoiceId) { ...InvoicePaymentFields }
    } ${INVOICE_PAYMENT_FRAGMENT}
  `,

  invoiceBalance: gql`
    query InvoiceBalance($invoiceId: UUID!) {
      invoiceBalance(invoiceId: $invoiceId) { ...InvoiceBalanceFields }
    } ${INVOICE_BALANCE_FRAGMENT}
  `,

  invoicePaymentsByStation: gql`
    query InvoicePaymentsByStation($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      invoicePaymentsByStation(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        ...InvoicePaymentFields
        invoice { id invoiceNumber fuelKind totalAmount dispatchDate receivingGasStation { id name } }
      }
    } ${INVOICE_PAYMENT_FRAGMENT}
  `,

  unpaidInvoices: gql`
    query UnpaidInvoices($gasStationId: UUID!) {
      unpaidInvoices(gasStationId: $gasStationId) { ...InvoiceBalanceFields }
    } ${INVOICE_BALANCE_FRAGMENT}
  `,

  invoiceProfitMargin: gql`
    query InvoiceProfitMargin($gasStationId: UUID!, $startDate: DateTime!, $endDate: DateTime!) {
      invoiceProfitMargin(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        gasStationId
        periodStart
        periodEnd
        totalRevenue
        totalInvoicedCost
        totalPaidCost
        grossMargin
        grossMarginPercent
        pendingInvoicesAmount
      }
    }
  `,
}

export const MUTATIONS = {
  createInvoicePayment: gql`
    mutation CreateInvoicePayment($input: CreateInvoicePaymentInput!) {
      createInvoicePayment(input: $input) { ...InvoicePaymentFields }
    } ${INVOICE_PAYMENT_FRAGMENT}
  `,

  updateInvoicePayment: gql`
    mutation UpdateInvoicePayment($id: UUID!, $input: UpdateInvoicePaymentInput!) {
      updateInvoicePayment(id: $id, input: $input) { ...InvoicePaymentFields }
    } ${INVOICE_PAYMENT_FRAGMENT}
  `,

  deleteInvoicePayment: gql`
    mutation DeleteInvoicePayment($id: UUID!) { deleteInvoicePayment(id: $id) }
  `,
}
