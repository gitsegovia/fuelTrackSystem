import { gql } from '@apollo/client'

const EMPLOYEE_SHIFT_FRAGMENT = gql`
  fragment EmployeeShiftFields on EmployeeShift {
    id
    employeeId
    gasStationId
    employeeRole
    shiftStartTime
    shiftEndTime
    createdAt
    employee { id firstName lastName }
    gasStation { id name }
  }
`

export const QUERIES = {
  employeeShifts: gql`
    query EmployeeShifts { employeeShifts { ...EmployeeShiftFields } } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  employeeShift: gql`
    query EmployeeShift($id: UUID!) { employeeShift(id: $id) { ...EmployeeShiftFields } } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  employeeShiftsByGasStation: gql`
    query EmployeeShiftsByGasStation($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      employeeShiftsByGasStation(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) { ...EmployeeShiftFields }
    } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  activeEmployeeShift: gql`
    query ActiveEmployeeShift($employeeId: UUID!) {
      activeEmployeeShift(employeeId: $employeeId) { ...EmployeeShiftFields }
    } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createEmployeeShift: gql`
    mutation CreateEmployeeShift($input: CreateEmployeeShiftInput!) {
      createEmployeeShift(input: $input) { ...EmployeeShiftFields }
    } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  endEmployeeShift: gql`
    mutation EndEmployeeShift($id: UUID!, $shiftEndTime: DateTime!) {
      endEmployeeShift(id: $id, shiftEndTime: $shiftEndTime) { ...EmployeeShiftFields }
    } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  updateEmployeeShift: gql`
    mutation UpdateEmployeeShift($id: UUID!, $input: UpdateEmployeeShiftInput!) {
      updateEmployeeShift(id: $id, input: $input) { ...EmployeeShiftFields }
    } ${EMPLOYEE_SHIFT_FRAGMENT}
  `,
  deleteEmployeeShift: gql`
    mutation DeleteEmployeeShift($id: UUID!) { deleteEmployeeShift(id: $id) }
  `,
}
