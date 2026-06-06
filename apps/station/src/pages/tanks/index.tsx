import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { MUTATIONS as MeasurementMutations } from '@/services/graphql/gql/tankMeasurement'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { useOffline } from '@/context/OfflineContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const TANKS_WITH_LATEST = gql`
  query TanksWithLatest($gasStationId: UUID!) {
    tanksByGasStation(gasStationId: $gasStationId) {
      id
      name
      maxCapacityLiters
      minOperatingVolumeLiters
      currentVolumeLiters
      currentHeightCm
      fuelType { id name }
      measurements {
        id manualLevelReadingCm volumeInLiters measurementTime measurementReason
        employee { id firstName lastName }
      }
    }
  }
`

const MEASUREMENT_REASON_LABELS: Record<string, string> = {
  SHIFT_CLOSURE: 'Cierre de turno',
  DISPATCH_RECEPTION: 'Recepción de despacho',
  DAILY_CLOSING: 'Cierre diario',
  AFTER_RECEPTION: 'Después de recepción',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  OTHER: 'Otro',
}

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

function TankLevelBar({ current, max, min }: { current: number; max: number; min: number }) {
  const pct = max > 0 ? Math.min(current / max, 1) : 0
  const minPct = max > 0 ? min / max : 0
  const isLow = current <= min
  const isCritical = current <= min * 0.5

  return (
    <div className="space-y-1">
      <div className="relative h-4 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isCritical ? 'bg-destructive' : isLow ? 'bg-amber-500' : 'bg-green-500'
          )}
          style={{ width: `${pct * 100}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-300/80"
          style={{ left: `${minPct * 100}%` }}
          title={`Mínimo operativo: ${min.toLocaleString()} L`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{(pct * 100).toFixed(1)}% lleno</span>
        <span>{current.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {max.toLocaleString()} L</span>
      </div>
    </div>
  )
}

function TankCard({ tank, employeeId, refetch }: { tank: any; employeeId: string; refetch: () => void }) {
  const [open, setOpen] = useState(false)
  const [levelCm, setLevelCm] = useState('')
  const [volumeL, setVolumeL] = useState('')
  const [reason, setReason] = useState('SHIFT_CLOSURE')
  const [notes, setNotes] = useState('')
  const { isOnline } = useOffline()

  const [createMeasurement, { loading: saving }] = useOfflineMutation(
    MeasurementMutations.createTankMeasurement
  )

  const currentVolume = parseFloat(tank.currentVolumeLiters ?? '0')
  const maxCapacity = parseFloat(tank.maxCapacityLiters)
  const minOperating = parseFloat(tank.minOperatingVolumeLiters)
  const isLow = currentVolume <= minOperating
  const isCritical = currentVolume <= minOperating * 0.5
  const hasVolume = tank.currentVolumeLiters !== null && tank.currentVolumeLiters !== undefined

  const sortedMeasurements = [...(tank.measurements ?? [])].sort(
    (a: any, b: any) => new Date(b.measurementTime).getTime() - new Date(a.measurementTime).getTime()
  )
  const lastMeasurement = sortedMeasurements[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cm = parseFloat(levelCm)
    const vol = parseFloat(volumeL)
    if (isNaN(cm) || cm < 0 || isNaN(vol) || vol < 0) {
      toast.error('Ingresa valores válidos.')
      return
    }
    try {
      const { wasQueued } = await createMeasurement({
        variables: {
          input: {
            tankId: tank.id,
            employeeId,
            measurementTime: new Date().toISOString(),
            manualLevelReadingCm: cm,
            volumeInLiters: vol,
            measurementReason: reason,
            notes: notes.trim() || null,
          },
        },
      })
      if (wasQueued) {
        toast.success('Medición guardada. Se enviará al servidor cuando vuelva la conexión.')
      } else {
        toast.success('Medición registrada.')
        refetch()
      }
      setLevelCm('')
      setVolumeL('')
      setNotes('')
      setOpen(false)
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  return (
    <Card className={cn(isCritical && 'border-destructive/50', isLow && !isCritical && 'border-amber-400/50')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{tank.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{tank.fuelType.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!hasVolume && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Sin medición</Badge>
            )}
            {hasVolume && isCritical && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="size-3" /> Crítico
              </Badge>
            )}
            {hasVolume && isLow && !isCritical && (
              <Badge className="text-xs gap-1 bg-amber-500 hover:bg-amber-500">
                <AlertTriangle className="size-3" /> Nivel bajo
              </Badge>
            )}
            {hasVolume && !isLow && (
              <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-400/50">
                <CheckCircle2 className="size-3" /> OK
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasVolume ? (
          <TankLevelBar current={currentVolume} max={maxCapacity} min={minOperating} />
        ) : (
          <div className="h-4 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Sin datos de nivel</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Capacidad máx.</p>
            <p className="font-medium">{maxCapacity.toLocaleString()} L</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mínimo operativo</p>
            <p className={cn('font-medium', isLow ? 'text-amber-600' : '')}>
              {minOperating.toLocaleString()} L
            </p>
          </div>
          {tank.currentHeightCm && (
            <div>
              <p className="text-muted-foreground">Nivel actual</p>
              <p className="font-medium">{parseFloat(tank.currentHeightCm).toFixed(1)} cm</p>
            </div>
          )}
          {lastMeasurement && (
            <div>
              <p className="text-muted-foreground">Última medición</p>
              <p className="font-medium">{format(new Date(lastMeasurement.measurementTime), 'dd/MM HH:mm')}</p>
              <p className="text-muted-foreground">{lastMeasurement.employee?.firstName} {lastMeasurement.employee?.lastName}</p>
            </div>
          )}
        </div>

        {sortedMeasurements.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Últimas mediciones
            </p>
            <div className="space-y-1">
              {sortedMeasurements.slice(0, 5).map((m: any) => (
                <div key={m.id} className="grid grid-cols-3 gap-2 text-xs rounded-md bg-muted/30 px-3 py-1.5">
                  <span className="text-muted-foreground">{format(new Date(m.measurementTime), 'dd/MM HH:mm')}</span>
                  <span className="font-mono font-medium text-center">
                    {parseFloat(m.volumeInLiters).toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                  </span>
                  <span className="text-muted-foreground text-right truncate">
                    {m.employee?.firstName} {m.employee?.lastName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            Registrar medición
          </Button>

          {open && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              {!isOnline && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <WifiOff className="size-3 shrink-0" />
                  <span>Sin conexión — se guardará localmente.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nivel (cm) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={levelCm}
                    onChange={(e) => setLevelCm(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volumen (L) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={volumeL}
                    onChange={(e) => setVolumeL(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo *</Label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={selectClass}
                >
                  {Object.entries(MEASUREMENT_REASON_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notas (opcional)</Label>
                <Input
                  placeholder="Observaciones..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? 'Guardando...' : !isOnline ? 'Guardar offline' : 'Confirmar medición'}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function TanksPage() {
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e: any) => e.user.id === user?.id)

  const { data, loading, refetch } = useQuery<{ tanksByGasStation: any[] }>(TANKS_WITH_LATEST, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const tanks: any[] = data?.tanksByGasStation ?? []

  const critical = tanks.filter((t) => {
    const cur = parseFloat(t.currentVolumeLiters ?? '0')
    const min = parseFloat(t.minOperatingVolumeLiters)
    return t.currentVolumeLiters !== null && cur <= min * 0.5
  })
  const low = tanks.filter((t) => {
    const cur = parseFloat(t.currentVolumeLiters ?? '0')
    const min = parseFloat(t.minOperatingVolumeLiters)
    return t.currentVolumeLiters !== null && cur > min * 0.5 && cur <= min
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario de tanques"
        description={user?.assignedGasStation?.name ?? ''}
      />

      {(critical.length > 0 || low.length > 0) && (
        <div className="space-y-2">
          {critical.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>{critical.map((t) => t.name).join(', ')}</strong> — nivel crítico.
                Requiere reabastecimiento inmediato.
              </span>
            </div>
          )}
          {low.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>{low.map((t) => t.name).join(', ')}</strong> — por debajo del mínimo operativo.
              </span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : tanks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tanques configurados en esta estación.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tanks.map((tank: any) => (
            <TankCard
              key={tank.id}
              tank={tank}
              employeeId={employee?.id ?? ''}
              refetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  )
}
