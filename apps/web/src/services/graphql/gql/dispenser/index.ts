import { gql } from '@apollo/client'

const DISPENSER_FRAGMENT = gql`
  fragment DispenserFields on Dispenser {
    id
    name
    isOperational
    gasStationId
    pumpIslandId
    tankId
    fuelTypeId
    fuelType { id name }
    tank { id name }
    nozzles { id name isOperational }
    createdAt
  }
`

export const QUERIES = {
  dispenser: gql`
    query Dispenser($id: UUID!) { dispenser(id: $id) { ...DispenserFields } } ${DISPENSER_FRAGMENT}
  `,
  dispensersByGasStation: gql`
    query DispensersByGasStation($gasStationId: UUID!) {
      dispensersByGasStation(gasStationId: $gasStationId) { ...DispenserFields }
    } ${DISPENSER_FRAGMENT}
  `,
  dispensersByPumpIsland: gql`
    query DispensersByPumpIsland($pumpIslandId: UUID!) {
      dispensersByPumpIsland(pumpIslandId: $pumpIslandId) { ...DispenserFields }
    } ${DISPENSER_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createDispenser: gql`
    mutation CreateDispenser($input: CreateDispenserInput!) {
      createDispenser(input: $input) { ...DispenserFields }
    } ${DISPENSER_FRAGMENT}
  `,
  updateDispenser: gql`
    mutation UpdateDispenser($id: UUID!, $input: UpdateDispenserInput!) {
      updateDispenser(id: $id, input: $input) { ...DispenserFields }
    } ${DISPENSER_FRAGMENT}
  `,
  deleteDispenser: gql`
    mutation DeleteDispenser($id: UUID!) { deleteDispenser(id: $id) }
  `,
}
