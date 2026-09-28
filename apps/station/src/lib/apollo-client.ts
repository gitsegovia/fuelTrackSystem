import { ApolloClient, ApolloLink, InMemoryCache, Observable, from } from '@apollo/client'
import type { FieldPolicy } from '@apollo/client'
import { createHttpLink } from '@apollo/client/link/http'
import { setContext } from '@apollo/client/link/context'
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist'
import { print } from 'graphql'
import { enqueue } from './offline-db'
import { getDeviceFingerprint, getStoredUserId } from './device-fingerprint'

import type { QueueReason } from './offline-sync'

export let onMutationQueued: ((reason?: QueueReason) => void) | null = null
export function setMutationQueuedCallback(fn: (reason?: QueueReason) => void) {
  onMutationQueued = fn
}

// Detecta fallo de red real — compatible con Chrome, Firefox y Safari.
// Firefox reporta la conexión caída como error CORS con statusCode null.
export function isNetworkDown(err: unknown): boolean {
  if (!err) return false
  const e = err as any
  if (e?.statusCode) return false // Error HTTP del servidor, no corte de red
  const msg: string = (e?.message ?? '').toLowerCase()
  return (
    e instanceof TypeError ||
    !navigator.onLine ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('cross-origin') ||
    msg.includes('cors') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
}

function buildOfflineLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    return new Observable((observer) => {
      let sub: { unsubscribe(): void } | null = null
      try {
        sub = forward(operation).subscribe({
          next(value) { observer.next(value) },
          error(err) {
            // useOfflineMutation maneja su propio encolado con metadatos completos
            // (localId, dependsOn). Si el caller activó skipOfflineLink, no duplicar.
            const skip = operation.getContext().skipOfflineLink
            const isMutation = operation.query.definitions.some(
              (d: any) => d.kind === 'OperationDefinition' && d.operation === 'mutation'
            )
            if (!skip && isMutation && isNetworkDown(err)) {
              // Red de seguridad para mutations que no usan useOfflineMutation: el intento
              // original salió sin x-offline-mutation-id, así que no hay id previo que reusar;
              // enqueue genera uno nuevo (estable desde aquí en adelante).
              enqueue({
                operationName: operation.operationName ?? 'unknown',
                query: print(operation.query),
                variables: operation.variables as Record<string, unknown>,
                createdBy: getStoredUserId(),
                deviceFingerprint: getDeviceFingerprint(),
              })
                .then(() => onMutationQueued?.())
                .catch((qErr) => console.warn('[FuelTrack] Queue write failed:', qErr))
            }
            observer.error(err)
          },
          complete() { observer.complete() },
        })
      } catch (e) {
        observer.error(e)
      }
      return () => sub?.unsubscribe()
    })
  })
}

// Cache redirect: una query de detalle por id resuelve a la entidad ya normalizada
// (p. ej. un ticket o turno creado offline con su localId, o uno cargado por una lista).
function redirectById(__typename: string): FieldPolicy {
  return {
    read(existing, { args, toReference }) {
      return existing ?? (args?.id ? toReference({ __typename, id: args.id }) : undefined)
    },
  }
}

/** Se resuelve cuando el cache persistido ya se restauró (o falló la restauración). */
export let cacheRestored: Promise<void> = Promise.resolve()

// Inicialización síncrona: persistCache restaura el cache en segundo plano
// sobre la misma instancia de InMemoryCache sin bloquear el render inicial.
export function makeApolloClient() {
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          salesTicket: redirectById('SalesTicket'),
          employeeShift: redirectById('EmployeeShift'),
        },
      },
    },
  })

  cacheRestored = persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    maxSize: 1048576 * 5,
    debounce: 2000,
  })
    .then(() => console.debug('[FuelTrack] Apollo cache restored'))
    .catch((e) => {
      console.warn('[FuelTrack] Cache restore failed, starting fresh:', e)
      try { window.localStorage.removeItem('apollo-cache-persist') } catch {}
    })

  const httpLink = createHttpLink({
    uri: import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:4000/graphql',
  })

  const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('accessToken')
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    }
  })

  return new ApolloClient({
    link: from([buildOfflineLink(), authLink, httpLink]),
    cache,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
        // Sin errorPolicy 'all': en Apollo v4 un error de red con 'all' vacía `data` aunque el
        // cache la tenga, y offline ninguna página vería sus datos. El default ('none') la conserva.
      },
    },
  })
}
