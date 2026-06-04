import { gql } from '@apollo/client'

const CURRENCY_FRAGMENT = gql`
  fragment CurrencyFields on Currency {
    id
    name
    symbol
    exchangeRate
    createdAt
  }
`

export const QUERIES = {
  currencies: gql`
    query Currencies { currencies { ...CurrencyFields } } ${CURRENCY_FRAGMENT}
  `,
  currency: gql`
    query Currency($id: UUID!) { currency(id: $id) { ...CurrencyFields } } ${CURRENCY_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createCurrency: gql`
    mutation CreateCurrency($input: CreateCurrencyInput!) {
      createCurrency(input: $input) { ...CurrencyFields }
    } ${CURRENCY_FRAGMENT}
  `,
  updateCurrency: gql`
    mutation UpdateCurrency($id: UUID!, $input: UpdateCurrencyInput!) {
      updateCurrency(id: $id, input: $input) { ...CurrencyFields }
    } ${CURRENCY_FRAGMENT}
  `,
  deleteCurrency: gql`
    mutation DeleteCurrency($id: UUID!) { deleteCurrency(id: $id) }
  `,
}
