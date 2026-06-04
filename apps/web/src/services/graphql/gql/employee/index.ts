import { gql } from '@apollo/client'

const EMPLOYEE_FRAGMENT = gql`
  fragment EmployeeFields on Employee {
    id
    firstName
    lastName
    position
    createdAt
    user { id username role }
    gasStation { id name }
  }
`

export const QUERIES = {
  employees: gql`
    query Employees { employees { ...EmployeeFields } } ${EMPLOYEE_FRAGMENT}
  `,
  employee: gql`
    query Employee($id: UUID!) { employee(id: $id) { ...EmployeeFields } } ${EMPLOYEE_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createEmployee: gql`
    mutation CreateEmployee($input: CreateEmployeeInput!) {
      createEmployee(input: $input) { ...EmployeeFields }
    } ${EMPLOYEE_FRAGMENT}
  `,
  createEmployeeWithUser: gql`
    mutation CreateEmployeeWithUser($input: CreateEmployeeWithUserInput!) {
      createEmployeeWithUser(input: $input) { ...EmployeeFields }
    } ${EMPLOYEE_FRAGMENT}
  `,
  updateEmployee: gql`
    mutation UpdateEmployee($id: UUID!, $input: UpdateEmployeeInput!) {
      updateEmployee(id: $id, input: $input) { ...EmployeeFields }
    } ${EMPLOYEE_FRAGMENT}
  `,
  deleteEmployee: gql`
    mutation DeleteEmployee($id: UUID!) { deleteEmployee(id: $id) }
  `,
}
