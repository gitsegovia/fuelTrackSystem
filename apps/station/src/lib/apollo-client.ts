import { ApolloClient, ApolloLink, InMemoryCache, Observable, from } from '@apollo/client'
import { createHttpLink } from '@apollo/client/link/http'
import { setContext } from '@apollo/client/link/context'
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist'
import { print } from 'graphql'
import { enqueue } from './offline-db'

export let onMutationQueued: (() => void) | null = null
export function setMutationQueuedCallback(fn: () => void) {
  onMutationQueued = fn
}

// Detecta fallo de red real — compatible con Chrome, Firefox y Safari.
// Firefox reporta la conexión caída como error CORS con statusCode null.
function isNetworkDown(err: unknown): boolean {
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
            const isMutation = operation.query.definitions.some(
              (d: any) => d.kind === 'OperationDefinition' && d.operation === 'mutation'
            )
            if (isMutation && isNetworkDown(err)) {
              enqueue({
                operationName: operation.operationName ?? 'unknown',
                query: print(operation.query),
                variables: operation.variables as Record<string, unknown>,
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

// Inicialización síncrona: persistCache restaura el cache en segundo plano
// sobre la misma instancia de InMemoryCache sin bloquear el render inicial.
export function makeApolloClient() {
  const cache = new InMemoryCache()

  persistCache({
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
        ...({ errorPolicy: 'all' } as object),
      },
    },
  })
}
