import { useCallback, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import type { DocumentNode } from '@apollo/client'
import { print } from 'graphql'
import { enqueue } from '@/lib/offline-db'
import { onMutationQueued } from '@/lib/apollo-client'
import { useOffline } from '@/context/OfflineContext'

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

      // ── Modo offline: encolar sin intentar la red ─────────────────────────
      if (!isOnline || !navigator.onLine) {
        await enqueue({
          operationName,
          query: queryString,
          variables: (variables ?? {}) as Record<string, unknown>,
          localId,
          dependsOn,
        })
        // Notifica al OfflineContext para actualizar el badge de pendientes + toast
        onMutationQueued?.()

        // Escribe datos optimistas en el cache Apollo si el caller lo pide
        baseOptionsRef.current?.writeToCache?.(apolloClient.cache, { variables, localId })

        return {
          data: (optimisticResponse ?? null) as TData | null,
          wasQueued: true,
        }
      }

      // ── Modo online: intentar la mutation normalmente ─────────────────────
      setLoading(true)
      try {
        const result = await apolloClient.mutate<TData>({
          mutation,
          variables: variables as Record<string, any>,
          refetchQueries: baseOptionsRef.current?.refetchQueries as any,
          // Indica al OfflineLink que no duplique el encolado si la red cae mid-flight;
          // el bloque catch lo maneja aquí con los metadatos completos (localId, dependsOn).
          context: { skipOfflineLink: true },
        })
        return { data: result.data ?? null, wasQueued: false }

      } catch (err: unknown) {
        // Red cayó mientras enviaba: encolar con metadatos completos
        if (isNetworkError(err)) {
          await enqueue({
            operationName,
            query: queryString,
            variables: (variables ?? {}) as Record<string, unknown>,
            localId,
            dependsOn,
          })
          onMutationQueued?.()
          baseOptionsRef.current?.writeToCache?.(apolloClient.cache, { variables, localId })
          return {
            data: (optimisticResponse ?? null) as TData | null,
            wasQueued: true,
          }
        }
        // Error de aplicación (GraphQL error, 4xx/5xx): relanzar para que
        // el caller lo capture con try/catch y muestre el mensaje al usuario.
        throw err

      } finally {
        setLoading(false)
      }
    },
    // apolloClient y mutation son estables; isOnline cambia con la red
    [apolloClient, isOnline, mutation, operationName, queryString]
  )

  return [mutate, { loading }] as const
}
