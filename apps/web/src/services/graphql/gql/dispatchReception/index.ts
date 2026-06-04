import { gql } from '@apollo/client'

const DISPATCH_RECEPTION_FRAGMENT = gql`
  fragment DispatchReceptionFields on DispatchReception {
    id
    invoiceId
    tankId
    receivedLiters
    receptionDate
    initialTankReadingCm
    finalTankReadingCm
    initialTankVolumeLiters
    finalTankVolumeLiters
    createdAt
    tank { id name }
  }
`

export const QUERIES = {
  dispatchReceptionsByTank: gql`
    query DispatchReceptionsByTank($tankId: UUID!) {
      dispatchReceptionsByTank(tankId: $tankId) { ...DispatchReceptionFields }
    } ${DISPATCH_RECEPTION_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createDispatchReception: gql`
    mutation CreateDispatchReception($input: CreateDispatchReceptionInput!) {
      createDispatchReception(input: $input) { ...DispatchReceptionFields }
    } ${DISPATCH_RECEPTION_FRAGMENT}
  `,
  deleteDispatchReception: gql`
    mutation DeleteDispatchReception($id: UUID!) { deleteDispatchReception(id: $id) }
  `,
}
