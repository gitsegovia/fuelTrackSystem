import { gql } from '@apollo/client'

const SALES_TICKET_FRAGMENT = gql`
  fragment SalesTicketFields on SalesTicket {
    id
    ticketNumber
    gasStationId
    cashierShiftId
    dispatcherEmployeeId
    dispatcherShiftId
    dispenserNozzleId
    fuelTypeId
    requestedLiters
    actualLitersDispatched
    assignedSaleTypeConfigId
    ticketIssueTime
    paymentMode
    pricePerLiter
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
    query SalesTicketsByGasStation($gasStationId: UUID!, $date: DateTime) {
      salesTicketsByGasStation(gasStationId: $gasStationId, date: $date) { ...SalesTicketFields }
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
  salesTicketDifferential: gql`
    query SalesTicketDifferential($id: UUID!) {
      salesTicketDifferential(id: $id) {
        paidAmount
        dispatchedAmount
        refundedAmount
        differentialAmount
        differentialLiters
      }
    }
  `,
  dispatcherDifferentialSummary: gql`
    query DispatcherDifferentialSummary($gasStationId: UUID, $startDate: DateTime, $endDate: DateTime, $dispatcherShiftId: UUID) {
      dispatcherDifferentialSummary(
        gasStationId: $gasStationId
        startDate: $startDate
        endDate: $endDate
        dispatcherShiftId: $dispatcherShiftId
      ) {
        dispatcherEmployeeId
        ticketCount
        grossDifferentialLiters
        grossDifferentialAmount
        refundedLiters
        refundedAmount
        netDifferentialLiters
        netDifferentialAmount
      }
    }
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
  cancelSalesTicket: gql`
    mutation CancelSalesTicket($id: UUID!) {
      cancelSalesTicket(id: $id) { ...SalesTicketFields }
    } ${SALES_TICKET_FRAGMENT}
  `,
}
