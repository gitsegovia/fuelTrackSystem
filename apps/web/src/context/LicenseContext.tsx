'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { QUERIES } from '@/services/graphql/gql/license'
import { setLicenseErrorCallback, type LicenseErrorCode } from '@/lib/apollo-client'
import { LICENSE_READ_ONLY_MESSAGE, licenseStationLimitMessage } from '@/lib/license-messages'

export interface LicenseStatusInfo {
  mode: 'CCI1' | 'LEGACY'
  status: 'ACTIVE' | 'DUE_SOON' | 'GRACE' | 'READ_ONLY' | null
  plan: string | null
  maxStations: number | null
  activeStations: number
  expiresAt: string | null
  graceEndsAt: string | null
  daysRemaining: number | null
  readOnly: boolean
  customerName: string | null
  lastValidatedAt: string | null
  clockSkewDetected: boolean
}

interface LicenseContextValue {
  license: LicenseStatusInfo | null
  readOnly: boolean
}

const defaultValue: LicenseContextValue = { license: null, readOnly: false }

const LicenseContext = createContext<LicenseContextValue>(defaultValue)

// Cada pocas horas y al volver a la pestaña — no en cada página (T-051).
const POLL_MS = 6 * 60 * 60 * 1000

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { data, refetch } = useQuery<{ licenseStatus: LicenseStatusInfo }>(QUERIES.licenseStatus, {
    pollInterval: POLL_MS,
    fetchPolicy: 'cache-and-network',
  })

  const license = data?.licenseStatus ?? null

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refetch])

  useEffect(() => {
    const handleLicenseError = (code: LicenseErrorCode) => {
      if (code === 'LICENSE_READ_ONLY') toast.error(LICENSE_READ_ONLY_MESSAGE)
      else toast.error(licenseStationLimitMessage(license?.maxStations ?? null))
    }
    setLicenseErrorCallback(handleLicenseError)
    return () => setLicenseErrorCallback(null)
  }, [license])

  return (
    <LicenseContext.Provider value={{ license, readOnly: license?.readOnly ?? false }}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  return useContext(LicenseContext)
}
