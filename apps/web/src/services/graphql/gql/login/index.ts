import { gql } from '@apollo/client'

export const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    username
    role
    userType
    company {
      id
      name
    }
  }
`

export const MUTATIONS = {
  login: gql`
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        token
        user {
          ...UserFields
        }
      }
    }
    ${USER_FRAGMENT}
  `,
}

export const QUERIES = {
  me: gql`
    query Me {
      me {
        ...UserFields
      }
    }
    ${USER_FRAGMENT}
  `,
}
