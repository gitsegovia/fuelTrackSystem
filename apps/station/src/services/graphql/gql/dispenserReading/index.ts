import { gql } from '@apollo/client'

const DISPENSER_READING_FRAGMENT = gql`
  fragment DispenserReadingFields on DispenserReading {
    id
    dispenserNozzleId
    employeeShiftId
    readingTime
    meterReading
    readingType
    createdAt
    dispenserNozzle { id name }
  }
`

export const QUERIES = {
  dispenserReadingsByShift: gql`
    query DispenserReadingsByShift($employeeShiftId: UUID!) {
      dispenserReadingsByShift(employeeShiftId: $employeeShiftId) { ...DispenserReadingFields }
    } ${DISPENSER_READING_FRAGMENT}
  `,
  dispenserReadingsByNozzle: gql`
    query DispenserReadingsByNozzle($dispenserNozzleId: UUID!) {
      dispenserReadingsByNozzle(dispenserNozzleId: $dispenserNozzleId) { ...DispenserReadingFields }
    } ${DISPENSER_READING_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createDispenserReading: gql`
    mutation CreateDispenserReading($input: CreateDispenserReadingInput!) {
      createDispenserReading(input: $input) { ...DispenserReadingFields }
    } ${DISPENSER_READING_FRAGMENT}
  `,
  deleteDispenserReading: gql`
    mutation DeleteDispenserReading($id: UUID!) { deleteDispenserReading(id: $id) }
  `,
}
