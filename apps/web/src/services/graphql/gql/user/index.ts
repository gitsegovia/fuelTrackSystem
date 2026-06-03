import { gql } from '@apollo/client'

const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    username
    role
    userType
    createdAt
    company { id name }
    assignedGasStation { id name }
  }
`

export const QUERIES = {
  users: gql`
    query Users {
      users { ...UserFields }
    }
    ${USER_FRAGMENT}
  `,
  user: gql`
    query User($id: UUID!) {
      user(id: $id) { ...UserFields }
    }
    ${USER_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createUser: gql`
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) { ...UserFields }
    }
    ${USER_FRAGMENT}
  `,
  updateUser: gql`
    mutation UpdateUser($id: UUID!, $input: UpdateUserInput!) {
      updateUser(id: $id, input: $input) { ...UserFields }
    }
    ${USER_FRAGMENT}
  `,
  deleteUser: gql`
    mutation DeleteUser($id: UUID!) {
      deleteUser(id: $id)
    }
  `,
}
