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

// Link custom — controla explícitamente el Observable para evitar el crash
// "can't access property catch, n() is undefined" de Apollo v4 + onError
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
            if (isMutation && isNetworkDown(err) && typeof window !== 'undefined') {
              console.log('[FuelTrack] Queuing offline mutation:', operation.operationName, {
                errName: (err as any)?.name,
                errMsg: (err as any)?.message,
                navigatorOnline: navigator.onLine,
              })
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

// Inicialización SÍNCRONA — elimina el patrón async que causaba
// "Performance.measure: Given attribute end cannot be negative".
// persistCache restaura el cache en segundo plano sobre la misma instancia
// de InMemoryCache, sin bloquear el render inicial.
export function makeApolloClient() {
  const cache = new InMemoryCache()

  if (typeof window !== 'undefined') {
    persistCache({
      cache,
      storage: new LocalStorageWrapper(window.localStorage),
      maxSize: 1048576 * 5,
      debounce: 2000,
    })
      .then(() => console.log('[FuelTrack] Cache restored from localStorage'))
      .catch((e) => {
        console.warn('[FuelTrack] Cache restore failed, starting fresh:', e)
        try { window.localStorage.removeItem('apollo-cache-persist') } catch {}
      })
  }

  const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000/graphql',
  })

  const authLink = setContext((_, { headers }) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
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
