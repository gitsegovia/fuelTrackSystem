'use client'

import { WifiOff, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import { useOffline } from '@/context/OfflineContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineBanner() {
  const { isOnline, pendingCount, syncStatus, retrySync } = useOffline()

  // Online y sin pendientes → no mostrar nada
  if (isOnline && pendingCount === 0 && syncStatus === 'idle') return null

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium',
        'transition-colors duration-300',
        !isOnline
          ? 'bg-zinc-900 text-zinc-100'
          : syncStatus === 'error'
          ? 'bg-destructive/10 text-destructive border-b border-destructive/20'
          : syncStatus === 'syncing'
          ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
          : 'bg-green-50 text-green-800 border-b border-green-200'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="size-4 shrink-0" />
          <span>
            Sin conexión
            {pendingCount > 0 &&
              ` — ${pendingCount} operación${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de sincronizar`}
          </span>
        </>
      ) : syncStatus === 'syncing' ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>Sincronizando {pendingCount} operación{pendingCount !== 1 ? 'es' : ''}...</span>
        </>
      ) : syncStatus === 'error' ? (
        <>
          <WifiOff className="size-4 shrink-0" />
          <span>Error al sincronizar — {pendingCount} operación{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-auto text-xs"
            onClick={retrySync}
          >
            <RefreshCw className="size-3 mr-1" /> Reintentar
          </Button>
        </>
      ) : pendingCount === 0 && isOnline ? (
        <>
          <CheckCircle2 className="size-4 shrink-0 text-green-600" />
          <span>Sincronización completada</span>
        </>
      ) : null}
    </div>
  )
}
