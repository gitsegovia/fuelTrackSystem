import { gql } from '@apollo/client'

const TANK_MEASUREMENT_FRAGMENT = gql`
  fragment TankMeasurementFields on TankMeasurement {
    id
    tankId
    manualLevelReadingCm
    volumeInLiters
    measurementTime
    measurementReason
    notes
    createdAt
    employee { id firstName lastName }
  }
`

export const QUERIES = {
  latestTankMeasurement: gql`
    query LatestTankMeasurement($tankId: UUID!) {
      latestTankMeasurement(tankId: $tankId) { ...TankMeasurementFields }
    } ${TANK_MEASUREMENT_FRAGMENT}
  `,
  tankMeasurementsByTank: gql`
    query TankMeasurementsByTank($tankId: UUID!, $startDate: DateTime, $endDate: DateTime) {
      tankMeasurementsByTank(tankId: $tankId, startDate: $startDate, endDate: $endDate) { ...TankMeasurementFields }
    } ${TANK_MEASUREMENT_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createTankMeasurement: gql`
    mutation CreateTankMeasurement($input: CreateTankMeasurementInput!) {
      createTankMeasurement(input: $input) { ...TankMeasurementFields }
    } ${TANK_MEASUREMENT_FRAGMENT}
  `,
}
