import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Clock, Link2, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { useOffline } from '@/context/OfflineContext'
import { dequeueAll, getFailed, type FailedMutation, type QueuedMutation } from '@/lib/offline-db'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const OPERATION_LABELS: Record<string, string> = {
  CreateEmployeeShift: 'Iniciar turno',
  EndEmployeeShift: 'Finalizar turno',
  CreateDispenserReading: 'Lectura de surtidor',
  CreateSalesTicket: 'Emitir ticket',
  ProcessSalesTicketDispatch: 'Despacho de ticket',
  CreatePayments: 'Cobro de ticket',
  CompleteSalesTicketPayment: 'Completar ticket',
  CancelSalesTicket: 'Cancelar ticket',
  CreateTankMeasurement: 'Medición de tanque',
}

const label = (op: string) => OPERATION_LABELS[op] ?? op

/** Items que referencian el localId de `item` (fallarán si se descarta). */
function dependentsOf(item: QueuedMutation, all: QueuedMutation[]): QueuedMutation[] {
  if (!item.localId) return []
  const localId = item.localId
  return all.filter(
    (other) =>
      other.id !== item.id &&
      (other.dependsOn === localId || JSON.stringify(other.variables).includes(localId))
  )
}

function Meta({ item }: { item: QueuedMutation }) {
  return (
    <p className="text-xs text-muted-foreground">
      {format(new Date(item.timestamp), 'dd/MM/yyyy HH:mm')}
      {item.createdBy ? ` · ${item.createdBy}` : ''}
    </p>
  )
}

function Payload({ item }: { item: QueuedMutation }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver datos</summary>
      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
        {JSON.stringify(item.variables, null, 2)}
      </pre>
    </details>
  )
}

export default function SyncPage() {
  const { isOnline, pendingCount, failedCount, syncStatus, retrySync, retryFailed, discardFailed } = useOffline()
  const [queue, setQueue] = useState<QueuedMutation[]>([])
  const [failed, setFailed] = useState<FailedMutation[]>([])
  const [toDiscard, setToDiscard] = useState<FailedMutation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([dequeueAll(), getFailed()]).then(([q, f]) => {
      if (cancelled) return
      setQueue(q)
      setFailed(f)
    })
    return () => { cancelled = true }
  }, [pendingCount, failedCount, syncStatus])

  const all: QueuedMutation[] = [...failed, ...queue]
  const unsynced = new Set(all.map((i) => i.localId).filter(Boolean) as string[])
  const failedLocalIds = new Set(failed.map((i) => i.localId).filter(Boolean) as string[])

  const waitingOn = (item: QueuedMutation) => {
    const json = JSON.stringify(item.variables)
    return [...unsynced].find(
      (id) => id !== item.localId && (item.dependsOn === id || json.includes(id))
    )
  }

  const handleRetry = async (item: FailedMutation) => {
    setBusyId(item.id)
    try {
      await retryFailed(item.id)
      toast.info(`${label(item.operationName)}: se reintentará ${isOnline ? 'ahora' : 'al reconectar'}.`)
    } finally {
      setBusyId(null)
    }
  }

  const handleDiscard = async () => {
    if (!toDiscard) return
    const item = toDiscard
    setToDiscard(null)
    setBusyId(item.id)
    try {
      await discardFailed(item.id)
      toast.success(`${label(item.operationName)} descartada.`)
    } finally {
      setBusyId(null)
    }
  }

  const discardDependents = toDiscard ? dependentsOf(toDiscard, all) : []

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Sincronización"
        description="Operaciones guardadas en este dispositivo que aún no llegan al servidor"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={retrySync}
            disabled={!isOnline || syncStatus === 'syncing' || pendingCount === 0}
          >
            <RefreshCw className={syncStatus === 'syncing' ? 'size-4 animate-spin' : 'size-4'} />
            Sincronizar ahora
          </Button>
        }
      />

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff className="size-4 shrink-0" />
          <span>Sin conexión — las operaciones se enviarán al reconectar.</span>
        </div>
      )}

      {all.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-600" />
          Todo está sincronizado.
        </div>
      )}

      {failed.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="size-4" />
              Con error ({failed.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Se intentaron varias veces y el servidor las rechazó. Revisa el error y decide: reintentar
              (por ejemplo, después de corregir el dato en el servidor) o descartar.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {failed.map((item) => (
              <div key={item.id} className="space-y-2 rounded-lg border px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{label(item.operationName)}</p>
                    <Meta item={item} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => handleRetry(item)}
                    >
                      <RefreshCw className="size-3.5" /> Reintentar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyId === item.id}
                      onClick={() => setToDiscard(item)}
                    >
                      <Trash2 className="size-3.5" /> Descartar
                    </Button>
                  </div>
                </div>
                <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive break-words">
                  {item.lastError}
                </p>
                <Payload item={item} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Pendientes ({queue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.map((item) => {
              const blocker = waitingOn(item)
              return (
                <div key={item.id} className="space-y-2 rounded-lg border px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{label(item.operationName)}</p>
                      <Meta item={item} />
                    </div>
                    {blocker ? (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Link2 className="size-3" />
                        {failedLocalIds.has(blocker) ? 'Bloqueada por una operación con error' : 'Espera a otra operación'}
                      </Badge>
                    ) : item.retries > 0 ? (
                      <Badge variant="outline" className="text-xs text-amber-700 border-amber-400/50">
                        {item.retries} {item.retries === 1 ? 'intento fallido' : 'intentos fallidos'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">En cola</Badge>
                    )}
                  </div>
                  {item.lastError && (
                    <p className="text-xs text-amber-700 break-words">Último error: {item.lastError}</p>
                  )}
                  <Payload item={item} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDiscard}
        onOpenChange={(open) => { if (!open) setToDiscard(null) }}
        title={`¿Descartar "${toDiscard ? label(toDiscard.operationName) : ''}"?`}
        description={
          <div className="space-y-2">
            <p>La operación se eliminará de este dispositivo y no llegará al servidor. No se puede deshacer.</p>
            {discardDependents.length > 0 && (
              <p className="font-medium text-destructive">
                {discardDependents.length}{' '}
                {discardDependents.length === 1 ? 'operación depende' : 'operaciones dependen'} de esta (
                {[...new Set(discardDependents.map((d) => label(d.operationName)))].join(', ')}) y
                fallarán al sincronizar.
              </p>
            )}
          </div>
        }
        confirmLabel="Descartar"
        destructive
        onConfirm={handleDiscard}
      />
    </div>
  )
}
