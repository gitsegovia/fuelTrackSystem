import { gql } from '@apollo/client'

const TANK_ASSIGNMENT_FRAGMENT = gql`
  fragment TankAssignmentFields on TankAssignment {
    id
    createdAt
  }
`

export const QUERIES = {
  tankAssignment: gql`
    query TankAssignment($id: UUID!) { tankAssignment(id: $id) { ...TankAssignmentFields } } ${TANK_ASSIGNMENT_FRAGMENT}
  `,
  tankAssignments: gql`
    query TankAssignments { tankAssignments { ...TankAssignmentFields } } ${TANK_ASSIGNMENT_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createTankAssignment: gql`
    mutation CreateTankAssignment($input: CreateTankAssignmentInput!) {
      createTankAssignment(input: $input) { ...TankAssignmentFields }
    } ${TANK_ASSIGNMENT_FRAGMENT}
  `,
  deleteTankAssignment: gql`
    mutation DeleteTankAssignment($id: UUID!) { deleteTankAssignment(id: $id) }
  `,
}
