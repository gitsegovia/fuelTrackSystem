import { gql } from '@apollo/client'

const NOZZLE_FRAGMENT = gql`
  fragment DispenserNozzleFields on DispenserNozzle {
    id
    name
    initialMeterReading
    currentMeterReading
    isOperational
    dispenserId
    createdAt
  }
`

export const QUERIES = {
  dispenserNozzle: gql`
    query DispenserNozzle($id: UUID!) { dispenserNozzle(id: $id) { ...DispenserNozzleFields } } ${NOZZLE_FRAGMENT}
  `,
  dispenserNozzlesByDispenser: gql`
    query DispenserNozzlesByDispenser($dispenserId: UUID!) {
      dispenserNozzlesByDispenser(dispenserId: $dispenserId) { ...DispenserNozzleFields }
    } ${NOZZLE_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createDispenserNozzle: gql`
    mutation CreateDispenserNozzle($input: CreateDispenserNozzleInput!) {
      createDispenserNozzle(input: $input) { ...DispenserNozzleFields }
    } ${NOZZLE_FRAGMENT}
  `,
  updateDispenserNozzle: gql`
    mutation UpdateDispenserNozzle($id: UUID!, $input: UpdateDispenserNozzleInput!) {
      updateDispenserNozzle(id: $id, input: $input) { ...DispenserNozzleFields }
    } ${NOZZLE_FRAGMENT}
  `,
  deleteDispenserNozzle: gql`
    mutation DeleteDispenserNozzle($id: UUID!) { deleteDispenserNozzle(id: $id) }
  `,
}
