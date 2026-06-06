import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import { dequeueAll, incrementRetry, queueCount, removeFromQueue, updateQueueEntry } from '@/lib/offline-db'
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
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const syncing = useRef(false)

  const refreshCount = useCallback(async () => {
    const count = await queueCount()
    setPendingCount(count)
  }, [])

  useEffect(() => {
    setMutationQueuedCallback(() => {
      refreshCount()
      toast.info('Sin conexión — la operación se guardó y se enviará al reconectar.', {
        id: 'offline-queued',
        duration: 4000,
      })
    })
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
      // Agrupar por dependencias: primero los independientes, luego los que dependen de otros.
      // El remap de IDs locales → reales se aplica antes de ejecutar mutations dependientes.
      const localIdMap = new Map<string, string>() // localId → realId del servidor

      for (const item of queue) {
        if (item.retries >= MAX_RETRIES) {
          await removeFromQueue(item.id)
          continue
        }

        // Si esta mutation depende de un ID local, remapear antes de enviar
        let variables = item.variables
        if (item.dependsOn && localIdMap.has(item.dependsOn)) {
          const realId = localIdMap.get(item.dependsOn)!
          variables = remapLocalId(variables, item.dependsOn, realId)
          await updateQueueEntry({ ...item, variables })
        }

        try {
          const result = await apolloClient.mutate({
            mutation: gql(item.query),
            variables,
            context: {
              headers: {
                'x-offline-created-by': item.createdBy ?? '',
                'x-offline-device-fp': item.deviceFingerprint ?? '',
                'x-offline-queued-at': new Date(item.timestamp).toISOString(),
              },
            },
          })
          // Si esta mutation generó un ID real, guardarlo para dependientes posteriores
          if (item.localId) {
            const realId = extractFirstId(result.data)
            if (realId) localIdMap.set(item.localId, realId)
          }
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

// ── Helpers de reconciliación de IDs ─────────────────────────────────────────

function remapLocalId(
  variables: Record<string, unknown>,
  localId: string,
  realId: string
): Record<string, unknown> {
  const json = JSON.stringify(variables)
  return JSON.parse(json.split(localId).join(realId))
}

function extractFirstId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  for (const value of Object.values(data as object)) {
    if (value && typeof value === 'object' && 'id' in value) {
      return (value as { id: string }).id
    }
  }
  return null
}
