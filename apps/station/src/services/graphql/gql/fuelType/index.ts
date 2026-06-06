import { gql } from '@apollo/client'

const FUEL_TYPE_FRAGMENT = gql`
  fragment FuelTypeFields on FuelType {
    id
    name
    costPerLiter
    createdAt
  }
`

export const QUERIES = {
  fuelTypes: gql`
    query FuelTypes {
      fuelTypes { ...FuelTypeFields }
    }
    ${FUEL_TYPE_FRAGMENT}
  `,
  fuelType: gql`
    query FuelType($id: UUID!) {
      fuelType(id: $id) { ...FuelTypeFields }
    }
    ${FUEL_TYPE_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createFuelType: gql`
    mutation CreateFuelType($input: CreateFuelTypeInput!) {
      createFuelType(input: $input) { ...FuelTypeFields }
    }
    ${FUEL_TYPE_FRAGMENT}
  `,
  updateFuelType: gql`
    mutation UpdateFuelType($id: UUID!, $input: UpdateFuelTypeInput!) {
      updateFuelType(id: $id, input: $input) { ...FuelTypeFields }
    }
    ${FUEL_TYPE_FRAGMENT}
  `,
  deleteFuelType: gql`
    mutation DeleteFuelType($id: UUID!) {
      deleteFuelType(id: $id)
    }
  `,
}
