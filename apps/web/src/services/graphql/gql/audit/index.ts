import { gql } from '@apollo/client'

// ─── Fragments ────────────────────────────────────────────────────────────────

const GAS_STATION_BRIEF = gql`
  fragment GasStationBrief on GasStation {
    id
    name
    code
  }
`

const EMPLOYEE_BRIEF = gql`
  fragment EmployeeBrief on Employee {
    id
    firstName
    lastName
    position
  }
`

const SHIFT_BRIEF = gql`
  fragment ShiftBrief on EmployeeShift {
    id
    employeeRole
    shiftStartTime
    shiftEndTime
    employee { ...EmployeeBrief }
  }
  ${EMPLOYEE_BRIEF}
`

const TANK_BRIEF = gql`
  fragment TankBrief on Tank {
    id
    name
    maxCapacityLiters
    fuelType { id name }
  }
`

// ─── 1. Recepciones ───────────────────────────────────────────────────────────

export const QUERIES = {
  invoiceAudit: gql`
    query InvoiceAudit($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      invoiceAudit(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        invoiceId
        invoiceNumber
        controlNumber
        dispatchDate
        driverName
        driverIdNumber
        truckPlate
        tankPlate
        fuelKind
        invoicedLiters
        receivedLiters
        differential
        differentialPercent
        gasStation { ...GasStationBrief }
      }
    }
    ${GAS_STATION_BRIEF}
  `,

  driverAuditSummary: gql`
    query DriverAuditSummary($gasStationId: UUID, $startDate: DateTime, $endDate: DateTime) {
      driverAuditSummary(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        driverName
        driverIdNumber
        truckPlate
        totalDeliveries
        totalInvoicedLiters
        totalReceivedLiters
        totalDifferential
        avgDifferentialPercent
        shortDeliveries
        excessDeliveries
      }
    }
  `,

  // ─── 2. Turnos ──────────────────────────────────────────────────────────────

  shiftAudit: gql`
    query ShiftAudit($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      shiftAudit(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        shift { ...ShiftBrief }
        meterDeltaLiters
        cashierTicketLiters
        tankMeasurementLiters
        meterVsCashierDiff
        cashierVsTankDiff
        meterVsTankDiff
        totalTickets
        canceledTickets
      }
    }
    ${SHIFT_BRIEF}
    ${EMPLOYEE_BRIEF}
  `,

  shiftAuditDetail: gql`
    query ShiftAuditDetail($shiftId: UUID!) {
      shiftAuditDetail(shiftId: $shiftId) {
        shift { ...ShiftBrief }
        meterDeltaLiters
        cashierTicketLiters
        tankMeasurementLiters
        meterVsCashierDiff
        cashierVsTankDiff
        meterVsTankDiff
        totalTickets
        canceledTickets
      }
    }
    ${SHIFT_BRIEF}
    ${EMPLOYEE_BRIEF}
  `,

  // ─── 3. Bomberos ────────────────────────────────────────────────────────────

  dispatcherAudit: gql`
    query DispatcherAudit($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      dispatcherAudit(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        employee { ...EmployeeBrief }
        totalTickets
        totalRequestedLiters
        totalDispatchedLiters
        totalDifferential
        avgDifferentialPerTicket
        shortTickets
        excessTickets
        shortTicketPercent
      }
    }
    ${EMPLOYEE_BRIEF}
  `,

  // ─── 4. Tanques ─────────────────────────────────────────────────────────────

  tankBalanceAuditByStation: gql`
    query TankBalanceAuditByStation($gasStationId: UUID!, $startDate: DateTime!, $endDate: DateTime!) {
      tankBalanceAuditByStation(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        tank { ...TankBrief }
        periodStart
        periodEnd
        openingVolumeLiters
        totalReceivedLiters
        totalDispatchedLiters
        expectedClosingVolume
        actualClosingVolume
        varianceLiters
        variancePercent
      }
    }
    ${TANK_BRIEF}
  `,

  tankBalanceAudit: gql`
    query TankBalanceAudit($tankId: UUID!, $startDate: DateTime!, $endDate: DateTime!) {
      tankBalanceAudit(tankId: $tankId, startDate: $startDate, endDate: $endDate) {
        tank { ...TankBrief }
        periodStart
        periodEnd
        openingVolumeLiters
        totalReceivedLiters
        totalDispatchedLiters
        expectedClosingVolume
        actualClosingVolume
        varianceLiters
        variancePercent
      }
    }
    ${TANK_BRIEF}
  `,

  // ─── 5. Financiero ──────────────────────────────────────────────────────────

  shiftFinancialAudit: gql`
    query ShiftFinancialAudit($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      shiftFinancialAudit(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) {
        shift { ...ShiftBrief }
        totalExpectedAmount
        totalCollectedAmount
        financialDifferential
        cashAmount
        electronicAmount
        totalTickets
        completedTickets
        canceledTickets
        pendingTickets
      }
    }
    ${SHIFT_BRIEF}
    ${EMPLOYEE_BRIEF}
  `,
}
