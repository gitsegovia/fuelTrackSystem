import { gql } from '@apollo/client'

const TANK_FRAGMENT = gql`
  fragment TankFields on Tank {
    id
    name
    gasStationId
    fuelTypeId
    tankModelId
    maxCapacityLiters
    minOperatingVolumeLiters
    currentHeightCm
    currentVolumeLiters
    fuelType { id name }
    tankModel { id name nominalCapacity }
    createdAt
  }
`

export const QUERIES = {
  tank: gql`
    query Tank($id: UUID!) { tank(id: $id) { ...TankFields } } ${TANK_FRAGMENT}
  `,
  tanksByGasStation: gql`
    query TanksByGasStation($gasStationId: UUID!) {
      tanksByGasStation(gasStationId: $gasStationId) { ...TankFields }
    } ${TANK_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createTank: gql`
    mutation CreateTank($input: CreateTankInput!) {
      createTank(input: $input) { ...TankFields }
    } ${TANK_FRAGMENT}
  `,
  updateTank: gql`
    mutation UpdateTank($id: UUID!, $input: UpdateTankInput!) {
      updateTank(id: $id, input: $input) { ...TankFields }
    } ${TANK_FRAGMENT}
  `,
  deleteTank: gql`
    mutation DeleteTank($id: UUID!) { deleteTank(id: $id) }
  `,
}
