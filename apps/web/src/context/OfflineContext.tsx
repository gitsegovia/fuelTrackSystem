'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useApolloClient } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import {
  dequeueAll,
  incrementRetry,
  queueCount,
  removeFromQueue,
} from '@/lib/offline-db'
import { setMutationQueuedCallback } from '@/lib/apollo-client'

const MAX_RETRIES = 3

type SyncStatus = 'idle' | 'syncing' | 'error'

interface OfflineContextValue {
  isOnline: boolean
  pendingCount: number
  syncStatus: SyncStatus
  retrySync: () => void
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  syncStatus: 'idle',
  retrySync: () => {},
})

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const apolloClient = useApolloClient()
  // Siempre true en el primer render (SSR-safe).
  // Se actualiza al valor real tras la hidratación vía useEffect.
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const syncing = useRef(false)

  const refreshCount = useCallback(async () => {
    const count = await queueCount()
    setPendingCount(count)
  }, [])

  // Registrar callback para que apollo-client.ts notifique nuevas mutations encoladas
  useEffect(() => {
    setMutationQueuedCallback(() => {
      refreshCount()
      // Mostrar toast informativo en lugar de dejar el error del componente como única info
      toast.info('Sin conexión — la operación se guardó y se enviará al reconectar.', {
        id: 'offline-queued',
        duration: 4000,
      })
    })
  }, [refreshCount])

  useEffect(() => {
    // Sincronizar con el estado real de red tras la hidratación
    setIsOnline(navigator.onLine)
    refreshCount()
  }, [refreshCount])

  const processQueue = useCallback(async () => {
    if (syncing.current) return
    const queue = await dequeueAll()
    if (queue.length === 0) return

    syncing.current = true
    setSyncStatus('syncing')
    let hadError = false
    let synced = 0

    try {
      for (const item of queue) {
        if (item.retries >= MAX_RETRIES) {
          await removeFromQueue(item.id)
          continue
        }
        try {
          await apolloClient.mutate({
            mutation: gql(item.query),
            variables: item.variables,
          })
          await removeFromQueue(item.id)
          synced++
        } catch (err) {
          console.warn('[FuelTrack] Sync failed for', item.operationName, err)
          await incrementRetry(item.id)
          hadError = true
        }
      }
    } finally {
      syncing.current = false
      await refreshCount()
      setSyncStatus(hadError ? 'error' : 'idle')
      if (synced > 0 && !hadError) {
        toast.success(
          `${synced} operación${synced !== 1 ? 'es' : ''} sincronizada${synced !== 1 ? 's' : ''} correctamente.`,
          { id: 'offline-synced' }
        )
      }
    }
  }, [apolloClient, refreshCount])

  // Comprobar y sincronizar cuando la app recupera foco o visibilidad
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

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, syncStatus, retrySync }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}
