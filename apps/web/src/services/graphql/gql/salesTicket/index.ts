import { gql } from '@apollo/client'

const SALES_TICKET_FRAGMENT = gql`
  fragment SalesTicketFields on SalesTicket {
    id
    ticketNumber
    gasStationId
    cashierShiftId
    dispatcherEmployeeId
    dispenserNozzleId
    fuelTypeId
    requestedLiters
    actualLitersDispatched
    assignedSaleTypeConfigId
    ticketIssueTime
    totalAmountExpected
    status
    createdAt
    fuelType { id name }
    assignedSaleTypeConfig {
      id
      saleTypeName
      salePricePerLiter
      currency { id symbol exchangeRate }
    }
  }
`

export const QUERIES = {
  salesTicketsByGasStation: gql`
    query SalesTicketsByGasStation($gasStationId: UUID!) {
      salesTicketsByGasStation(gasStationId: $gasStationId) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
  salesTicketsByCashierShift: gql`
    query SalesTicketsByCashierShift($cashierShiftId: UUID!) {
      salesTicketsByCashierShift(cashierShiftId: $cashierShiftId) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
  salesTicket: gql`
    query SalesTicket($id: UUID!) { salesTicket(id: $id) { ...SalesTicketFields } } ${SALES_TICKET_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createSalesTicket: gql`
    mutation CreateSalesTicket($input: CreateSalesTicketInput!) {
      createSalesTicket(input: $input) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
  processSalesTicketDispatch: gql`
    mutation ProcessSalesTicketDispatch($id: UUID!, $dispatcherEmployeeId: UUID!, $dispenserNozzleId: UUID!, $actualLitersDispatched: Decimal!) {
      processSalesTicketDispatch(id: $id, dispatcherEmployeeId: $dispatcherEmployeeId, dispenserNozzleId: $dispenserNozzleId, actualLitersDispatched: $actualLitersDispatched) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
  completeSalesTicketPayment: gql`
    mutation CompleteSalesTicketPayment($id: UUID!) {
      completeSalesTicketPayment(id: $id) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
  cancelSalesTicket: gql`
    mutation CancelSalesTicket($id: UUID!) {
      cancelSalesTicket(id: $id) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
}
