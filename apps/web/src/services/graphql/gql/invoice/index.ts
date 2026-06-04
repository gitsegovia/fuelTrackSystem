import { gql } from '@apollo/client'

const INVOICE_FRAGMENT = gql`
  fragment InvoiceFields on Invoice {
    id
    invoiceNumber
    controlNumber
    sealNumber
    liters
    dispatchDate
    dischargeDate
    truckIdentifier
    fuelKind
    totalAmount
    costPerLiter
    createdAt
    receivingGasStation { id name }
    currency { id name symbol }
  }
`

export const QUERIES = {
  invoices: gql`
    query Invoices { invoices { ...InvoiceFields } } ${INVOICE_FRAGMENT}
  `,
  invoice: gql`
    query Invoice($id: UUID!) { invoice(id: $id) { ...InvoiceFields } } ${INVOICE_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createInvoice: gql`
    mutation CreateInvoice($input: CreateInvoiceInput!) {
      createInvoice(input: $input) { ...InvoiceFields }
    } ${INVOICE_FRAGMENT}
  `,
  updateInvoice: gql`
    mutation UpdateInvoice($id: UUID!, $input: UpdateInvoiceInput!) {
      updateInvoice(id: $id, input: $input) { ...InvoiceFields }
    } ${INVOICE_FRAGMENT}
  `,
  deleteInvoice: gql`
    mutation DeleteInvoice($id: UUID!) { deleteInvoice(id: $id) }
  `,
}
