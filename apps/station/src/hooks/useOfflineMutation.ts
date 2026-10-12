import { useCallback, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import type { DocumentNode } from '@apollo/client'
import { print } from 'graphql'
import { onMutationQueued } from '@/lib/apollo-client'
import { sendOrQueue } from '@/lib/offline-sync'
import { useOffline } from '@/context/OfflineContext'
import { getDeviceFingerprint, getStoredUserId } from '@/lib/device-fingerprint'
import { withSessionRetry } from '@/lib/auth-session'
import { NON_RETRYABLE_MESSAGES, graphQLErrorCode } from '@/lib/graphql-errors'
import { QUERIES as LicenseQueries } from '@/services/graphql/gql/license'

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface OfflineMutateOptions<TVariables = Record<string, any>> {
  variables?: TVariables
  /**
   * UUID generado por el caller para identificar el resultado de esta mutation.
   * El proceso de sync lo usa para remap dependsOn → ID real del servidor.
   */
  localId?: string
  /**
   * localId de una mutation anterior cuyo resultado este necesita.
   * Ejemplo: processDispatch depende del ID de createSalesTicket.
   */
  dependsOn?: string
  /**
   * Dato a devolver cuando la mutation se encola offline.
   * Permite al caller continuar el flujo (navegar, actualizar UI) sin esperar red.
   */
  optimisticResponse?: unknown
}

export interface OfflineMutateResult<TData> {
  data: TData | null
  /** true = la mutation se encoló; se ejecutará cuando vuelva la conexión */
  wasQueued: boolean
}

export interface UseOfflineMutationOptions<TVariables = Record<string, any>> {
  refetchQueries?: Array<{
    query: DocumentNode
    variables?: Record<string, unknown>
  }>
  /**
   * Escribe en el cache Apollo cuando la mutation se encola offline.
   * Permite UI optimista inmediata sin datos reales del servidor.
   * Se llama con (cache, { variables, localId }) para que el caller
   * haga writeQuery/writeFragment con los datos optimistas.
   * Se tipea como `any` para el cache porque Apollo v4 no re-exporta
   * InMemoryCache de forma compatible con el tipo de apolloClient.cache.
   */
  writeToCache?: (
    cache: any,
    opts: { variables?: TVariables; localId?: string }
  ) => void
}

// ── Utilidad interna ──────────────────────────────────────────────────────────

/**
 * Distingue errores de red reales de errores HTTP del servidor.
 * Los errores HTTP (4xx/5xx) NO se encolan: reenviarlos no cambiaría el resultado.
 */
function isNetworkError(err: unknown): boolean {
  if (!err) return false
  const e = err as any
  const status = e?.statusCode ?? e?.networkError?.statusCode
  if (status && typeof status === 'number' && status >= 400) return false
  const msg: string = (e?.message ?? '').toLowerCase()
  return (
    e instanceof TypeError ||
    !navigator.onLine ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('cross-origin') ||
    msg.includes('cors') ||
    msg.includes('load failed')
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Reemplaza `useMutation` para operations que deben funcionar offline.
 *
 * Flujo:
 *   - Offline (o red caída durante el request): encola en IndexedDB y devuelve
 *     `{ wasQueued: true, data: optimisticResponse }` sin lanzar error.
 *   - Online con éxito: `{ wasQueued: false, data: <respuesta real> }`.
 *   - Online con error de aplicación (GraphQL/4xx): relanza la excepción.
 *
 * ID reconciliation:
 *   - Pasa `localId` al crear entidades (ej. createSalesTicket).
 *   - Pasa `dependsOn: localId` en mutations dependientes de ese ID.
 *   - El sync en OfflineContext remapea los IDs locales → reales al sincronizar.
 */
export function useOfflineMutation<TData = unknown>(
  mutation: DocumentNode,
  baseOptions?: UseOfflineMutationOptions
) {
  const apolloClient = useApolloClient()
  const { isOnline } = useOffline()
  const [loading, setLoading] = useState(false)

  // Ref para que el callback no se recree cuando cambia refetchQueries/writeToCache
  const baseOptionsRef = useRef(baseOptions)
  baseOptionsRef.current = baseOptions

  // Estables: mutation es una constante de módulo
  const operationName = (mutation.definitions[0] as any)?.name?.value ?? 'unknown'
  const queryString = print(mutation)

  const mutate = useCallback(
    async (opts: OfflineMutateOptions = {}): Promise<OfflineMutateResult<TData>> => {
      const { variables, localId, dependsOn, optimisticResponse } = opts
      const online = isOnline && navigator.onLine

      if (online) setLoading(true)
      try {
        // Errores de aplicación (GraphQL, 4xx/5xx) se relanzan para que el caller los muestre.
        const outcome = await sendOrQueue({
          online,
          operationName,
          query: queryString,
          variables: (variables ?? {}) as Record<string, unknown>,
          localId,
          dependsOn,
          createdBy: getStoredUserId(),
          deviceFingerprint: getDeviceFingerprint(),
          isNetworkError,
          send: async ({ variables: vars, headers }) => {
            try {
              const result = await withSessionRetry(apolloClient, () =>
                apolloClient.mutate<TData>({
                  mutation,
                  variables: vars as Record<string, any>,
                  refetchQueries: baseOptionsRef.current?.refetchQueries as any,
                  // skipOfflineLink: si la red cae mid-flight, sendOrQueue encola con el mismo id;
                  // el OfflineLink no debe duplicar el encolado.
                  context: { skipOfflineLink: true, headers },
                })
              )
              return result.data ?? null
            } catch (err) {
              const code = graphQLErrorCode(err)
              if (code === 'LICENSE_READ_ONLY') {
                apolloClient.refetchQueries({ include: [LicenseQueries.licenseStatus] }).catch(() => {})
              }
              if (code && NON_RETRYABLE_MESSAGES[code]) throw new Error(NON_RETRYABLE_MESSAGES[code])
              throw err
            }
          },
        })

        if (!outcome.queued) {
          return { data: outcome.data as TData | null, wasQueued: false }
        }
        // Notifica al OfflineContext para actualizar el badge de pendientes + toast
        onMutationQueued?.(outcome.reason)
        // Escribe datos optimistas en el cache Apollo si el caller lo pide
        baseOptionsRef.current?.writeToCache?.(apolloClient.cache, { variables, localId })
        return { data: (optimisticResponse ?? null) as TData | null, wasQueued: true }
      } finally {
        if (online) setLoading(false)
      }
    },
    // apolloClient y mutation son estables; isOnline cambia con la red
    [apolloClient, isOnline, mutation, operationName, queryString]
  )

  return [mutate, { loading }] as const
}
