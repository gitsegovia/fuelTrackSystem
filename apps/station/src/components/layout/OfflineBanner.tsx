import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import { useOffline } from '@/context/OfflineContext'

export function OfflineBanner() {
  const { isOnline, pendingCount, syncStatus, retrySync } = useOffline()

  if (isOnline && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-sm shrink-0">
        <WifiOff className="size-4 text-amber-600 shrink-0" />
        <span className="text-amber-700 font-medium">Sin conexión</span>
        {pendingCount > 0 && (
          <span className="text-amber-600 ml-1">
            — {pendingCount} operación{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div className="flex items-center gap-2 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-sm shrink-0">
        <RefreshCw className="size-4 text-blue-600 animate-spin shrink-0" />
        <span className="text-blue-700 font-medium">
          Sincronizando {pendingCount} operación{pendingCount !== 1 ? 'es' : ''}...
        </span>
      </div>
    )
  }

  if (syncStatus === 'error' && pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm shrink-0">
        <AlertCircle className="size-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium">
          {pendingCount} operación{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar
        </span>
        <button
          onClick={retrySync}
          className="ml-auto text-xs underline text-destructive hover:text-destructive/80 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return null
}
