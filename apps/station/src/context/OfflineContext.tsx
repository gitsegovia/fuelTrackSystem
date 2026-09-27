import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import {
  dequeueAll,
  discardFailed,
  failedCount as countFailed,
  getFailed,
  getIdMap,
  moveToFailed,
  queueCount,
  removeFromQueue,
  requeueFailed,
  saveIdMapping,
  updateQueueEntry,
} from '@/lib/offline-db'
import { extractFirstId, findPendingRef, remapKnownIds } from '@/lib/offline-sync'
import { isNetworkDown, setMutationQueuedCallback } from '@/lib/apollo-client'

const MAX_RETRIES = 3
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

  const runSync = useCallback(async () => {
    const queue = await dequeueAll()
    if (queue.length === 0) return

    setSyncStatus('syncing')
    let hadError = false
    let synced = 0
    let movedToFailed = 0

    try {
      const idMap = await getIdMap()
      const failed = await getFailed()
      // localIds cuyo create todavía no llegó al servidor: sus dependientes esperan.
      const pending = new Set(
        [...queue, ...failed].map((i) => i.localId).filter((id): id is string => !!id)
      )

      for (const item of queue) {
        // Items de la versión anterior que ya habían agotado reintentos: no se borran.
        if (item.retries >= MAX_RETRIES) {
          await moveToFailed(item, item.lastError ?? 'Reintentos agotados')
          movedToFailed++
          continue
        }

        const variables = remapKnownIds(item.variables, idMap)
        if (findPendingRef(variables, pending, { ownLocalId: item.localId, dependsOn: item.dependsOn })) {
          continue // espera a que se sincronice (o se resuelva) la operación de la que depende
        }
        if (variables !== item.variables) {
          await updateQueueEntry({ ...item, variables })
        }

        try {
          const result = await apolloClient.mutate({
            mutation: gql(item.query),
            variables,
            context: {
              // Evita que buildOfflineLink encole una copia si la red cae durante el sync
              skipOfflineLink: true,
              headers: {
                'x-offline-created-by': item.createdBy ?? '',
                'x-offline-device-fp': item.deviceFingerprint ?? '',
                'x-offline-queued-at': new Date(item.timestamp).toISOString(),
              },
            },
          })
          if (item.localId) {
            const realId = extractFirstId(result.data)
            if (realId) {
              await saveIdMapping(item.localId, realId)
              idMap.set(item.localId, realId)
            }
            pending.delete(item.localId)
          }
          await removeFromQueue(item.id)
          synced++
        } catch (err) {
          hadError = true
          if (isNetworkDown(err)) {
            // Se cayó la red: no cuenta como intento; el resto también fallaría.
            break
          }
          console.warn('[FuelTrack] Sync failed for', item.operationName, err)
          const lastError = (err as Error)?.message || 'Error desconocido'
          const retries = item.retries + 1
          if (retries >= MAX_RETRIES) {
            await moveToFailed({ ...item, variables, retries }, lastError)
            movedToFailed++
          } else {
            await updateQueueEntry({ ...item, variables, retries, lastError })
          }
        }
      }
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
  }, [apolloClient, refreshCount])

  const processQueue = useCallback(async () => {
    if (syncing.current) return
    syncing.current = true
    try {
      // Una sola pestaña sincroniza a la vez; si otra tiene el lock, esta no envía nada.
      if (navigator.locks) {
        await navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => {
          if (lock) await runSync()
        })
      } else {
        await runSync()
      }
    } catch (err) {
      console.warn('[FuelTrack] Sync aborted:', err)
      setSyncStatus('error')
    } finally {
      syncing.current = false
    }
  }, [runSync])

  processQueueRef.current = processQueue

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
