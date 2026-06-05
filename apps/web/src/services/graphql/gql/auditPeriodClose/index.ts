import { gql } from '@apollo/client'

const AUDIT_CLOSE_FRAGMENT = gql`
  fragment AuditPeriodCloseFields on AuditPeriodClose {
    id
    gasStationId
    closedById
    periodStart
    periodEnd
    closeType
    status
    createdAt
    gasStation { id name code }
    closedBy { id username }
    summary {
      invoiceCount
      totalInvoicedLiters
      totalReceivedLiters
      invoiceDifferential
      shiftCount
      grossMargin
      grossMarginPercent
      pendingInvoicesAmount
    }
  }
`

export const QUERIES = {
  auditPeriodCloses: gql`
    query AuditPeriodCloses($gasStationId: UUID!) {
      auditPeriodCloses(gasStationId: $gasStationId) { ...AuditPeriodCloseFields }
    } ${AUDIT_CLOSE_FRAGMENT}
  `,

  auditPeriodClose: gql`
    query AuditPeriodClose($id: UUID!) {
      auditPeriodClose(id: $id) {
        ...AuditPeriodCloseFields
        invoiceSnapshot
        shiftSnapshot
        dispatcherSnapshot
        tankSnapshot
        financialSnapshot
        driverSnapshot
        marginSnapshot
      }
    } ${AUDIT_CLOSE_FRAGMENT}
  `,
}

export const MUTATIONS = {
  createAuditPeriodClose: gql`
    mutation CreateAuditPeriodClose($input: CreateAuditPeriodCloseInput!) {
      createAuditPeriodClose(input: $input) { ...AuditPeriodCloseFields }
    } ${AUDIT_CLOSE_FRAGMENT}
  `,

  confirmAuditPeriodClose: gql`
    mutation ConfirmAuditPeriodClose($id: UUID!) {
      confirmAuditPeriodClose(id: $id) { ...AuditPeriodCloseFields }
    } ${AUDIT_CLOSE_FRAGMENT}
  `,

  recalculateAuditPeriodClose: gql`
    mutation RecalculateAuditPeriodClose($id: UUID!) {
      recalculateAuditPeriodClose(id: $id) { ...AuditPeriodCloseFields }
    } ${AUDIT_CLOSE_FRAGMENT}
  `,

  deleteAuditPeriodClose: gql`
    mutation DeleteAuditPeriodClose($id: UUID!) { deleteAuditPeriodClose(id: $id) }
  `,
}
