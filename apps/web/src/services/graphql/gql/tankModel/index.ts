import { gql } from '@apollo/client'

const TANK_MODEL_FRAGMENT = gql`
  fragment TankModelFields on TankModel {
    id
    name
    nominalCapacity
    shape
    lengthCm
    diameterCm
    widthCm
    heightCm
    description
    createdAt
  }
`

export const QUERIES = {
  tankModels: gql`
    query TankModels { tankModels { ...TankModelFields } } ${TANK_MODEL_FRAGMENT}
  `,
  tankModel: gql`
    query TankModel($id: UUID!) { tankModel(id: $id) { ...TankModelFields } } ${TANK_MODEL_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createTankModel: gql`
    mutation CreateTankModel($input: CreateTankModelInput!) {
      createTankModel(input: $input) { ...TankModelFields }
    } ${TANK_MODEL_FRAGMENT}
  `,
  updateTankModel: gql`
    mutation UpdateTankModel($id: UUID!, $input: UpdateTankModelInput!) {
      updateTankModel(id: $id, input: $input) { ...TankModelFields }
    } ${TANK_MODEL_FRAGMENT}
  `,
  deleteTankModel: gql`
    mutation DeleteTankModel($id: UUID!) { deleteTankModel(id: $id) }
  `,
}
