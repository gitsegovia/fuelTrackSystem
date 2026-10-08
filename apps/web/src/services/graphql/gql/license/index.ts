import { gql } from '@apollo/client'

export const QUERIES = {
  licenseStatus: gql`
    query LicenseStatus {
      licenseStatus {
        mode
        status
        plan
        maxStations
        activeStations
        expiresAt
        graceEndsAt
        daysRemaining
        readOnly
        customerName
        lastValidatedAt
        clockSkewDetected
      }
    }
  `,
}
