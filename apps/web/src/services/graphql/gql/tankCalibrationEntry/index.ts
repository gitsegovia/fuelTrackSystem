import { gql } from '@apollo/client'

const CALIBRATION_FRAGMENT = gql`
  fragment CalibrationEntryFields on TankCalibrationEntry {
    id
    tankModelId
    heightCm
    volumeLiters
    createdAt
  }
`

export const QUERIES = {
  tankCalibrationEntriesByModel: gql`
    query TankCalibrationEntriesByModel($tankModelId: UUID!) {
      tankCalibrationEntriesByModel(tankModelId: $tankModelId) { ...CalibrationEntryFields }
    } ${CALIBRATION_FRAGMENT}
  `,
}

export const MUTATIONS = {
  bulkCreateTankCalibrationEntries: gql`
    mutation BulkCreateTankCalibrationEntries($tankModelId: UUID!, $entries: [CalibrationRowInput!]!) {
      bulkCreateTankCalibrationEntries(tankModelId: $tankModelId, entries: $entries) { ...CalibrationEntryFields }
    } ${CALIBRATION_FRAGMENT}
  `,
  deleteTankCalibrationEntry: gql`
    mutation DeleteTankCalibrationEntry($id: UUID!) { deleteTankCalibrationEntry(id: $id) }
  `,
}
