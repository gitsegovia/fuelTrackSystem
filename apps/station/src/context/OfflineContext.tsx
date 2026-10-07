import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import {
  dequeueAll,
  discardFailed,
  failedCount as countFailed,
  queueCount,
  requeueFailed,
} from '@/lib/offline-db'
import { syncQueue } from '@/lib/offline-sync'
import { isNetworkDown, setMutationQueuedCallback } from '@/lib/apollo-client'
import { ensureFreshAccessToken, expireSession, forceRefreshAccessToken } from '@/lib/auth-session'
import { useAuth } from '@/hooks/useAuth'

const SYNC_LOCK = 'fueltrack-offline-sync'

type SyncStatus = 'idle' | 'syncing' | 'error'

interface OfflineContextValue {
  isOnline: boolean
  pendingCount: number
  /** Operaciones que agotaron reintentos y esperan decisión del usuario */
  failedCount: number
  syncStatus: SyncStatus
  retrySync: () => void
  retryFailed: (id: string) => Promise<void>
  discardFailed: (id: string) => Promise<void>
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  failedCount: 0,
  syncStatus: 'idle',
  retrySync: () => {},
  retryFailed: async () => {},
  discardFailed: async () => {},
})

function plural(n: number, singular: string, pluralForm: string) {
  return n === 1 ? singular : pluralForm
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const apolloClient = useApolloClient()
  const hasSession = !!useAuth().user
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const syncing = useRef(false)
  const processQueueRef = useRef<() => Promise<void>>(async () => {})

  const refreshCount = useCallback(async () => {
    const [pending, failed] = await Promise.all([queueCount(), countFailed()])
    setPendingCount(pending)
    setFailedCount(failed)
  }, [])

  useEffect(() => {
    setMutationQueuedCallback((reason) => {
      refreshCount()
      if (reason === 'waiting-dependency') {
        toast.info('Guardado: se enviará después de sincronizar la operación de la que depende.', {
          id: 'offline-queued-dependency',
          duration: 4000,
        })
        processQueueRef.current()
        return
      }
      toast.info('Sin conexión — la operación se guardó y se enviará al reconectar.', {
        id: 'offline-queued',
        duration: 4000,
      })
    })
    refreshCount()
  }, [refreshCount])

  /** Devuelve true si el servidor rechazó la sesión (la cola queda intacta). */
  const runSync = useCallback(async (): Promise<boolean> => {
    const queue = await dequeueAll()
    if (queue.length === 0) return false

    setSyncStatus('syncing')
    let hadError = false
    let synced = 0
    let movedToFailed = 0
    let unauthenticated = false

    try {
      const result = await syncQueue(queue, {
        isNetworkError: isNetworkDown,
        mutate: async ({ query, variables, headers }) => {
          const res = await apolloClient.mutate({
            mutation: gql(query),
            variables,
            // Evita que buildOfflineLink encole una copia si la red cae durante el sync
            context: { skipOfflineLink: true, headers },
          })
          return res.data
        },
      })
      ;({ hadError, synced, movedToFailed, unauthenticated } = result)
    } catch (err) {
      hadError = true
      throw err
    } finally {
      await refreshCount()
      setSyncStatus(hadError ? 'error' : 'idle')
      if (synced > 0) {
        // Reemplaza en pantalla los datos optimistas (IDs locales) por los del servidor.
        apolloClient.refetchQueries({ include: 'active' }).catch(() => {})
        if (!hadError) {
          toast.success(
            `${synced} ${plural(synced, 'operación sincronizada', 'operaciones sincronizadas')} correctamente.`,
            { id: 'offline-synced' }
          )
        }
      }
      if (movedToFailed > 0) {
        toast.error(
          `${movedToFailed} ${plural(movedToFailed, 'operación no se pudo sincronizar', 'operaciones no se pudieron sincronizar')}. Revísalas en Sincronización.`,
          { id: 'offline-failed', duration: 8000 }
        )
      }
    }
    return unauthenticated
  }, [apolloClient, refreshCount])

  const processQueue = useCallback(async () => {
    if (syncing.current) return
    // Sin sesión (pantalla de login) no se envía nada: se sincroniza al iniciar sesión.
    if (!localStorage.getItem('accessToken')) return
    syncing.current = true
    try {
      // ADR-014: renueva antes de sincronizar. Si el servidor pide re-login, el callback de
      // AuthContext cierra la sesión (sin tocar la cola) y esta corrida se aborta acá.
      try {
        await ensureFreshAccessToken(apolloClient)
      } catch {
        return
      }
      // T-044: si el servidor rechaza la sesión, se renueva una vez y se reintenta. Si vuelve a
      // rechazarla, la sesión termina y la cola queda para después del próximo login.
      const syncWithSession = async () => {
        if (!(await runSync())) return
        await forceRefreshAccessToken(apolloClient)
        if (await runSync()) throw expireSession('INVALID_REFRESH_TOKEN')
      }
      // Una sola pestaña sincroniza a la vez; si otra tiene el lock, esta no envía nada.
      if (navigator.locks) {
        await navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => {
          if (lock) await syncWithSession()
        })
      } else {
        await syncWithSession()
      }
    } catch (err) {
      console.warn('[FuelTrack] Sync aborted:', err)
      setSyncStatus('error')
    } finally {
      syncing.current = false
    }
  }, [runSync])

  processQueueRef.current = processQueue

  // Al arrancar la app (sesión restaurada) o al iniciar sesión, con red: sincroniza sin
  // esperar a un evento online/focus/visibilitychange.
  useEffect(() => {
    if (hasSession && navigator.onLine) processQueue()
  }, [hasSession, processQueue])

  const checkAndSync = useCallback(() => {
    const online = navigator.onLine
    setIsOnline(online)
    if (online) processQueue()
  }, [processQueue])

  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true);  processQueue() }
    const handleOffline = () => { setIsOnline(false); setSyncStatus('idle') }
    const handleFocus   = () => checkAndSync()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAndSync()
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus',   handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus',   handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [processQueue, checkAndSync])

  const retrySync = useCallback(() => {
    setSyncStatus('idle')
    processQueue()
  }, [processQueue])

  const retryFailed = useCallback(async (id: string) => {
    await requeueFailed(id)
    await refreshCount()
    if (navigator.onLine) processQueue()
  }, [processQueue, refreshCount])

  const discard = useCallback(async (id: string) => {
    await discardFailed(id)
    await refreshCount()
  }, [refreshCount])

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        failedCount,
        syncStatus,
        retrySync,
        retryFailed,
        discardFailed: discard,
      }}
    >
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}
