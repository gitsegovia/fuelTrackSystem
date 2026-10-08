import { gql } from '@apollo/client'

export const QUERIES = {
  // T-050/T-053. En modo LEGACY `status` es null y `readOnly` es false: no hay nada que avisar.
  licenseStatus: gql`
    query LicenseStatus {
      licenseStatus {
        mode
        status
        expiresAt
        graceEndsAt
        daysRemaining
        readOnly
        clockSkewDetected
      }
    }
  `,
}
