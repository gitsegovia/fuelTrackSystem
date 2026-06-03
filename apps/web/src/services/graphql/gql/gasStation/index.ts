import { gql } from '@apollo/client'

const GAS_STATION_FRAGMENT = gql`
  fragment GasStationFields on GasStation {
    id
    name
    code
    address
    createdAt
    company { id name }
  }
`

export const QUERIES = {
  gasStations: gql`
    query GasStations {
      gasStations { ...GasStationFields }
    }
    ${GAS_STATION_FRAGMENT}
  `,
  gasStation: gql`
    query GasStation($id: UUID!) {
      gasStation(id: $id) { ...GasStationFields }
    }
    ${GAS_STATION_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createGasStation: gql`
    mutation CreateGasStation($input: CreateGasStationInput!) {
      createGasStation(input: $input) { ...GasStationFields }
    }
    ${GAS_STATION_FRAGMENT}
  `,
  updateGasStation: gql`
    mutation UpdateGasStation($id: UUID!, $input: UpdateGasStationInput!) {
      updateGasStation(id: $id, input: $input) { ...GasStationFields }
    }
    ${GAS_STATION_FRAGMENT}
  `,
  deleteGasStation: gql`
    mutation DeleteGasStation($id: UUID!) {
      deleteGasStation(id: $id)
    }
  `,
}
