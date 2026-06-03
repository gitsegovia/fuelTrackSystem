import { gql } from '@apollo/client'

const PUMP_ISLAND_FRAGMENT = gql`
  fragment PumpIslandFields on PumpIsland {
    id
    name
    description
    gasStationId
    createdAt
  }
`

export const QUERIES = {
  pumpIslands: gql`
    query PumpIslands { pumpIslands { ...PumpIslandFields } } ${PUMP_ISLAND_FRAGMENT}
  `,
  pumpIsland: gql`
    query PumpIsland($id: UUID!) { pumpIsland(id: $id) { ...PumpIslandFields } } ${PUMP_ISLAND_FRAGMENT}
  `,
  pumpIslandsByGasStation: gql`
    query PumpIslandsByGasStation($gasStationId: UUID!) {
      pumpIslandsByGasStation(gasStationId: $gasStationId) { ...PumpIslandFields }
    } ${PUMP_ISLAND_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createPumpIsland: gql`
    mutation CreatePumpIsland($input: CreatePumpIslandInput!) {
      createPumpIsland(input: $input) { ...PumpIslandFields }
    } ${PUMP_ISLAND_FRAGMENT}
  `,
  updatePumpIsland: gql`
    mutation UpdatePumpIsland($id: UUID!, $input: UpdatePumpIslandInput!) {
      updatePumpIsland(id: $id, input: $input) { ...PumpIslandFields }
    } ${PUMP_ISLAND_FRAGMENT}
  `,
  deletePumpIsland: gql`
    mutation DeletePumpIsland($id: UUID!) { deletePumpIsland(id: $id) }
  `,
}
