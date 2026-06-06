import { gql } from '@apollo/client'

const SALE_TYPE_CONFIG_FRAGMENT = gql`
  fragment SaleTypeConfigFields on SaleTypeConfig {
    id
    gasStationId
    fuelTypeId
    currencyId
    saleTypeName
    salePricePerLiter
    percentage
    createdAt
    gasStation { id name }
    fuelType { id name }
    currency { id name symbol }
  }
`

export const QUERIES = {
  saleTypeConfigs: gql`
    query SaleTypeConfigs { saleTypeConfigs { ...SaleTypeConfigFields } } ${SALE_TYPE_CONFIG_FRAGMENT}
  `,
  saleTypeConfig: gql`
    query SaleTypeConfig($id: UUID!) { saleTypeConfig(id: $id) { ...SaleTypeConfigFields } } ${SALE_TYPE_CONFIG_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createSaleTypeConfig: gql`
    mutation CreateSaleTypeConfig($input: CreateSaleTypeConfigInput!) {
      createSaleTypeConfig(input: $input) { ...SaleTypeConfigFields }
    } ${SALE_TYPE_CONFIG_FRAGMENT}
  `,
  updateSaleTypeConfig: gql`
    mutation UpdateSaleTypeConfig($id: UUID!, $input: UpdateSaleTypeConfigInput!) {
      updateSaleTypeConfig(id: $id, input: $input) { ...SaleTypeConfigFields }
    } ${SALE_TYPE_CONFIG_FRAGMENT}
  `,
  deleteSaleTypeConfig: gql`
    mutation DeleteSaleTypeConfig($id: UUID!) { deleteSaleTypeConfig(id: $id) }
  `,
}
