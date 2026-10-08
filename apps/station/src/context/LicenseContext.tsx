import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { QUERIES } from '@/services/graphql/gql/license'
import { useAuth } from '@/hooks/useAuth'
import { useOffline } from '@/context/OfflineContext'

export interface LicenseInfo {
  mode: string
  status: 'ACTIVE' | 'DUE_SOON' | 'GRACE' | 'READ_ONLY' | null
  expiresAt: string | null
  graceEndsAt: string | null
  daysRemaining: number | null
  readOnly: boolean
  clockSkewDetected: boolean
}

interface LicenseContextValue {
  /** Último estado conocido (del servidor o del cache persistido si no hay red). Null en LEGACY o sin datos. */
  license: LicenseInfo | null
  /** Solo lectura por licencia vencida (CCI1). En LEGACY siempre false. */
  readOnly: boolean
  refreshLicense: () => void
}

const LicenseContext = createContext<LicenseContextValue>({
  license: null,
  readOnly: false,
  refreshLicense: () => {},
})

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const apolloClient = useApolloClient()

  // cache-and-network (default del cliente): con red consulta al iniciar sesión; sin red queda el
  // último estado del cache persistido.
  const { data, refetch } = useQuery<{ licenseStatus: LicenseInfo }>(QUERIES.licenseStatus, {
    skip: !user,
  })

  const wasOnline = useRef(isOnline)
  useEffect(() => {
    if (user && isOnline && !wasOnline.current) refetch().catch(() => {})
    wasOnline.current = isOnline
  }, [isOnline, user, refetch])

  const refreshLicense = useCallback(() => {
    apolloClient.refetchQueries({ include: [QUERIES.licenseStatus] }).catch(() => {})
  }, [apolloClient])

  const info = data?.licenseStatus
  const license = info && info.mode === 'CCI1' ? info : null

  return (
    <LicenseContext.Provider value={{ license, readOnly: !!license?.readOnly, refreshLicense }}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  return useContext(LicenseContext)
}
