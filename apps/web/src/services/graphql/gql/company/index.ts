import { gql } from '@apollo/client'

export const COMPANY_FRAGMENT = gql`
  fragment CompanyFields on Company {
    id
    name
    address
    phone
    logo
    createdAt
    updatedAt
  }
`

export const QUERIES = {
  companies: gql`
    query Companies {
      companies {
        ...CompanyFields
      }
    }
    ${COMPANY_FRAGMENT}
  `,
  company: gql`
    query Company($id: UUID!) {
      company(id: $id) {
        ...CompanyFields
      }
    }
    ${COMPANY_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createCompany: gql`
    mutation CreateCompany($input: CreateCompanyInput!) {
      createCompany(input: $input) {
        ...CompanyFields
      }
    }
    ${COMPANY_FRAGMENT}
  `,
  updateCompany: gql`
    mutation UpdateCompany($id: UUID!, $input: UpdateCompanyInput!) {
      updateCompany(id: $id, input: $input) {
        ...CompanyFields
      }
    }
    ${COMPANY_FRAGMENT}
  `,
  deleteCompany: gql`
    mutation DeleteCompany($id: UUID!) {
      deleteCompany(id: $id)
    }
  `,
}
