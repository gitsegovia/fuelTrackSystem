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
    assignedGasStation {
      id
      name
    }
  }
`

const AUTH_PAYLOAD_FRAGMENT = gql`
  fragment AuthPayloadFields on AuthPayload {
    token
    accessTokenExpiresAt
    refreshToken
    sessionExpiresAt
    user {
      ...UserFields
    }
  }
  ${USER_FRAGMENT}
`

export const MUTATIONS = {
  login: gql`
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        ...AuthPayloadFields
      }
    }
    ${AUTH_PAYLOAD_FRAGMENT}
  `,
  // ADR-014: rota el refresh token. Errores (extensions.code): INVALID_REFRESH_TOKEN,
  // REFRESH_TOKEN_REUSED, SESSION_REVOKED, SESSION_EXPIRED y STATION_INACTIVE (D-19): todos piden re-login.
  refreshSession: gql`
    mutation RefreshSession($refreshToken: String!) {
      refreshSession(refreshToken: $refreshToken) {
        ...AuthPayloadFields
      }
    }
    ${AUTH_PAYLOAD_FRAGMENT}
  `,
  logout: gql`
    mutation Logout($refreshToken: String!) {
      logout(refreshToken: $refreshToken)
    }
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
