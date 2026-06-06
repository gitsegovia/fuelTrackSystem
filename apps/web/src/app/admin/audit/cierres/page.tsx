'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus, Lock, RefreshCw, Trash2, ChevronDown, ChevronRight,
  Loader2, Calendar, CalendarDays, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/auditPeriodClose'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditSummary = {
  invoiceCount: number
  totalInvoicedLiters: number
  totalReceivedLiters: number
  invoiceDifferential: number
  shiftCount: number
  grossMargin: number | null
  grossMarginPercent: number | null
  pendingInvoicesAmount: number | null
}

type AuditPeriodClose = {
  id: string
  gasStationId: string
  periodStart: string
  periodEnd: string
  closeType: 'MONTHLY' | 'MANUAL'
  status: 'DRAFT' | 'CLOSED'
  createdAt: string
  gasStation: { id: string; name: string; code: string }
  closedBy: { id: string; username: string }
  summary: AuditSummary
}

type CloseDetail = AuditPeriodClose & {
  invoiceSnapshot: any[] | null
  shiftSnapshot: any[] | null
  dispatcherSnapshot: any[] | null
  tankSnapshot: any[] | null
  financialSnapshot: any[] | null
  driverSnapshot: any[] | null
  marginSnapshot: any | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91', GASOLINE_95: 'Gasolina 95', DIESEL: 'Diésel', KEROSENE: 'Kerosene',
}

function fmt(v: number | null | undefined, dec = 2) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function DiffBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  const color = value < -0.01 ? 'text-destructive' : value > 0.01 ? 'text-emerald-600' : 'text-muted-foreground'
  return <span className={cn('font-medium', color)}>{value > 0 ? '+' : ''}{fmt(value)} L</span>
}

/** Extrae "yyyy-MM" del ISO string usando tiempo local (evita desfase UTC) */
function monthKey(isoDate: string) {
  return format(new Date(isoDate), 'yyyy-MM')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SnapshotInvoices({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Sin recepciones en el período.</p>
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b">
          <th className="text-left py-1.5 pr-3">Factura</th>
          <th className="text-left pr-3">Combustible</th>
          <th className="text-right pr-3">Facturado</th>
          <th className="text-right pr-3">Recibido</th>
          <th className="text-right">Diferencial</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-1.5 pr-3 font-medium">{r.invoiceNumber}</td>
            <td className="pr-3">{FUEL_KIND_LABELS[r.fuelKind] ?? r.fuelKind}</td>
            <td className="text-right pr-3">{fmt(r.invoicedLiters)} L</td>
            <td className="text-right pr-3">{fmt(r.receivedLiters)} L</td>
            <td className="text-right"><DiffBadge value={r.differential} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SnapshotMargin({ data }: { data: any }) {
  if (!data) return <p className="text-xs text-muted-foreground">Sin datos de margen.</p>
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {[
        { label: 'Ingresos (ventas)', value: fmt(data.totalRevenue) },
        { label: 'Costo facturado', value: fmt(data.totalInvoicedCost) },
        { label: 'Costo pagado', value: fmt(data.totalPaidCost) },
        { label: 'Facturas pendientes', value: fmt(data.pendingInvoicesAmount) },
        { label: 'Margen bruto', value: fmt(data.grossMargin), highlight: true },
        { label: '% Margen', value: `${fmt(data.grossMarginPercent, 1)}%`, highlight: true },
      ].map(({ label, value, highlight }) => (
        <div key={label} className="space-y-0.5">
          <p className="text-muted-foreground">{label}</p>
          <p className={cn('font-semibold', highlight ? 'text-primary' : '')}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function CloseDetailPanel({ closeId }: { closeId: string }) {
  const { data, loading } = useQuery<{ auditPeriodClose: CloseDetail }>(
    QUERIES.auditPeriodClose, { variables: { id: closeId } }
  )
  const [activeTab, setActiveTab] = useState<'invoices' | 'margin' | 'drivers'>('invoices')

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Cargando snapshot…
    </div>
  )
  const c = data?.auditPeriodClose
  if (!c) return null

  return (
    <div className="border-t pt-4 mt-2 space-y-3">
      <div className="flex gap-1">
        {[
          { key: 'invoices' as const, label: 'Recepciones' },
          { key: 'margin' as const, label: 'Margen' },
          { key: 'drivers' as const, label: 'Choferes' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {activeTab === 'invoices' && <SnapshotInvoices rows={c.invoiceSnapshot ?? []} />}
        {activeTab === 'margin' && <SnapshotMargin data={c.marginSnapshot} />}
        {activeTab === 'drivers' && (
          !c.driverSnapshot?.length
            ? <p className="text-xs text-muted-foreground">Sin datos de choferes.</p>
            : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1.5 pr-3">Chofer</th>
                    <th className="text-right pr-3">Entregas</th>
                    <th className="text-right pr-3">Facturado</th>
                    <th className="text-right pr-3">Recibido</th>
                    <th className="text-right">Diferencial</th>
                  </tr>
                </thead>
                <tbody>
                  {(c.driverSnapshot ?? []).map((d: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{d.driverName}</td>
                      <td className="text-right pr-3">{d.totalDeliveries}</td>
                      <td className="text-right pr-3">{fmt(d.totalInvoicedLiters)} L</td>
                      <td className="text-right pr-3">{fmt(d.totalReceivedLiters)} L</td>
                      <td className="text-right"><DiffBadge value={d.totalDifferential} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}
      </div>
    </div>
  )
}

// ─── Monthly close form ───────────────────────────────────────────────────────

function MonthlyCloseForm({
  stationId,
  closes,
  onCreated,
  onRecalc,
  creating,
  recalcing,
}: {
  stationId: string
  closes: AuditPeriodClose[]
  onCreated: (month: string) => void
  onRecalc: (id: string) => void
  creating: boolean
  recalcing: boolean
}) {
  const now = new Date()
  // Ofrecer los últimos 12 meses (excluye el mes actual incompleto como default)
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, i + 1)
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: es }) }
    })
  }, [])

  const [selectedMonth, setSelectedMonth] = useState(months[0].key)

  // Buscar cierre mensual existente para el mes seleccionado
  const existingClose = closes.find(
    c => c.closeType === 'MONTHLY' && monthKey(c.periodStart) === selectedMonth
  )

  const isAlreadyClosed = existingClose?.status === 'CLOSED'
  const hasDraft = existingClose?.status === 'DRAFT'

  function getMonthStatus(monthStr: string) {
    const c = closes.find(cl => cl.closeType === 'MONTHLY' && monthKey(cl.periodStart) === monthStr)
    if (!c) return 'available'
    return c.status === 'CLOSED' ? 'closed' : 'draft'
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Mes a cerrar</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {months.map(({ key, label }) => {
            const status = getMonthStatus(key)
            return (
              <button
                key={key}
                onClick={() => setSelectedMonth(key)}
                className={cn(
                  'relative flex flex-col items-start px-3 py-2 rounded-lg border text-left text-xs transition-colors',
                  selectedMonth === key
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-ring hover:text-foreground',
                  status === 'closed' && 'opacity-60'
                )}
              >
                <span className="font-medium capitalize">{label}</span>
                {status === 'closed' && (
                  <span className="flex items-center gap-1 text-emerald-600 mt-0.5">
                    <CheckCircle2 className="size-3" /> Cerrado
                  </span>
                )}
                {status === 'draft' && (
                  <span className="flex items-center gap-1 text-amber-600 mt-0.5">
                    <Clock className="size-3" /> Borrador
                  </span>
                )}
                {status === 'available' && (
                  <span className="flex items-center gap-1 text-muted-foreground mt-0.5">
                    <AlertCircle className="size-3" /> Pendiente
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action area for selected month */}
      <div className={cn(
        'rounded-lg border p-3 flex items-center justify-between gap-4',
        isAlreadyClosed ? 'bg-emerald-50 border-emerald-200' : hasDraft ? 'bg-amber-50 border-amber-200' : 'bg-muted/40'
      )}>
        <div className="text-sm">
          <span className="font-medium capitalize">{months.find(m => m.key === selectedMonth)?.label}</span>
          {isAlreadyClosed && (
            <span className="ml-2 text-xs text-emerald-600">Este mes ya está cerrado definitivamente.</span>
          )}
          {hasDraft && (
            <span className="ml-2 text-xs text-amber-600">Tiene un borrador — podés recalcular o confirmar.</span>
          )}
          {!existingClose && (
            <span className="ml-2 text-xs text-muted-foreground">Sin cierre registrado.</span>
          )}
        </div>
        {isAlreadyClosed ? (
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
        ) : hasDraft ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRecalc(existingClose!.id)}
            disabled={recalcing}
          >
            {recalcing ? <Loader2 className="size-4 animate-spin mr-1" /> : <RefreshCw className="size-4 mr-1" />}
            Recalcular borrador
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onCreated(selectedMonth)}
            disabled={creating}
          >
            {creating ? <Loader2 className="size-4 animate-spin mr-1" /> : <Calendar className="size-4 mr-1" />}
            Calcular cierre mensual
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Manual close form ────────────────────────────────────────────────────────

const manualSchema = z.object({
  periodStart: z.string().min(1, 'Requerido'),
  periodEnd: z.string().min(1, 'Requerido'),
}).refine(d => d.periodEnd >= d.periodStart, {
  message: 'La fecha fin debe ser posterior al inicio',
  path: ['periodEnd'],
})

type ManualFormData = z.infer<typeof manualSchema>

function ManualCloseForm({
  onCreated,
  creating,
}: {
  onCreated: (start: string, end: string) => void
  creating: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
  })

  return (
    <form
      onSubmit={handleSubmit(v => onCreated(v.periodStart, v.periodEnd))}
      className="space-y-4"
    >
      <p className="text-xs text-muted-foreground">
        Los cierres manuales son para cálculos puntuales. No reemplazan al cierre mensual oficial del período.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha inicio <span className="text-destructive">*</span></Label>
          <Input {...register('periodStart')} type="date" className="h-8" aria-invalid={!!errors.periodStart} />
          {errors.periodStart && <p className="text-xs text-destructive">{errors.periodStart.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha fin <span className="text-destructive">*</span></Label>
          <Input {...register('periodEnd')} type="date" className="h-8" aria-invalid={!!errors.periodEnd} />
          {errors.periodEnd && <p className="text-xs text-destructive">{errors.periodEnd.message}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin mr-1" /> : <CalendarDays className="size-4 mr-1" />}
          Calcular cierre manual
        </Button>
      </div>
    </form>
  )
}

// ─── Close card ───────────────────────────────────────────────────────────────

function CloseCard({
  close,
  expanded,
  onToggle,
  onConfirm,
  onRecalc,
  onDelete,
  recalcing,
}: {
  close: AuditPeriodClose
  expanded: boolean
  onToggle: () => void
  onConfirm: () => void
  onRecalc: () => void
  onDelete: () => void
  recalcing: boolean
}) {
  const isDraft = close.status === 'DRAFT'
  const isMonthly = close.closeType === 'MONTHLY'
  const s = close.summary

  return (
    <Card className={cn(
      'transition-colors',
      isDraft && 'border-amber-400/40',
      isMonthly && !isDraft && 'border-primary/20',
    )}>
      <CardHeader className="pb-0 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onToggle}
              className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
            >
              {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
              {isMonthly
                ? format(new Date(close.periodStart), 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())
                : `${format(new Date(close.periodStart), 'd MMM', { locale: es })} — ${format(new Date(close.periodEnd), 'd MMM yyyy', { locale: es })}`
              }
            </button>

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0',
                isMonthly ? 'text-primary border-primary/40' : 'text-muted-foreground border-border'
              )}
            >
              {isMonthly ? 'Mensual' : 'Manual'}
            </Badge>

            <Badge
              variant="outline"
              className={isDraft
                ? 'text-amber-600 border-amber-500/40 bg-amber-50 text-[10px] px-1.5 py-0'
                : 'text-emerald-600 border-emerald-500/40 bg-emerald-50 text-[10px] px-1.5 py-0'
              }
            >
              {isDraft ? 'Borrador' : 'Confirmado'}
            </Badge>

            <span className="text-xs text-muted-foreground truncate">por {close.closedBy.username}</span>
          </div>

          {isDraft && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" title="Recalcular snapshot" onClick={onRecalc} disabled={recalcing}>
                <RefreshCw className={cn('size-4', recalcing && 'animate-spin')} />
              </Button>
              <Button variant="ghost" size="icon" title="Confirmar cierre (inmutable)" onClick={onConfirm}>
                <Lock className="size-4 text-primary" />
              </Button>
              <Button variant="ghost" size="icon" title="Eliminar borrador" onClick={onDelete}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2.5 pb-1 text-xs text-muted-foreground">
          <span>
            {s.invoiceCount} facturas ·{' '}
            <span className="text-foreground font-medium">{fmt(s.totalInvoicedLiters)} L</span>
          </span>
          <span>Diferencial: <DiffBadge value={s.invoiceDifferential} /></span>
          <span>{s.shiftCount} turnos</span>
          {s.grossMargin !== null && (
            <span>
              Margen:{' '}
              <span className={cn('font-medium', s.grossMargin >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                {fmt(s.grossMargin)} ({fmt(s.grossMarginPercent, 1)}%)
              </span>
            </span>
          )}
          {s.pendingInvoicesAmount !== null && s.pendingInvoicesAmount > 0.01 && (
            <span className="text-amber-600">Fact. pendientes: {fmt(s.pendingInvoicesAmount)}</span>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-4">
          <CloseDetailPanel closeId={close.id} />
        </CardContent>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditCierresPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const stationId = searchParams.get('stationId') ?? ''

  const [mode, setMode] = useState<'MONTHLY' | 'MANUAL'>('MONTHLY')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [creatingMode, setCreatingMode] = useState<'MONTHLY' | 'MANUAL' | null>(null)
  const [recalcingId, setRecalcingId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ auditPeriodCloses: AuditPeriodClose[] }>(
    QUERIES.auditPeriodCloses,
    { variables: { gasStationId: stationId }, skip: !stationId }
  )

  const [createClose] = useMutation(MUTATIONS.createAuditPeriodClose)
  const [confirmClose] = useMutation(MUTATIONS.confirmAuditPeriodClose)
  const [recalcClose] = useMutation(MUTATIONS.recalculateAuditPeriodClose)
  const [deleteClose] = useMutation(MUTATIONS.deleteAuditPeriodClose)

  const closes = data?.auditPeriodCloses ?? []

  // Mostrar: primero borradores, luego mensuales confirmados
  const sortedCloses = [
    ...closes.filter(c => c.status === 'DRAFT'),
    ...closes.filter(c => c.status === 'CLOSED').sort((a, b) =>
      new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
    ),
  ]

  const handleCreateMonthly = async (monthStr: string) => {
    if (!user || !stationId) return
    setCreatingMode('MONTHLY')
    try {
      const [year, month] = monthStr.split('-').map(Number)
      const d = new Date(year, month - 1, 1) // constructor local — evita desfase UTC
      await createClose({
        variables: {
          input: {
            gasStationId: stationId,
            closedById: user.id,
            periodStart: startOfMonth(d).toISOString(),
            periodEnd: endOfMonth(d).toISOString(),
            closeType: 'MONTHLY',
          },
        },
      })
      toast.success(`Cierre de ${format(d, 'MMMM yyyy', { locale: es })} creado como borrador.`)
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear el cierre.')
    } finally {
      setCreatingMode(null)
    }
  }

  const handleCreateManual = async (start: string, end: string) => {
    if (!user || !stationId) return
    setCreatingMode('MANUAL')
    try {
      await createClose({
        variables: {
          input: {
            gasStationId: stationId,
            closedById: user.id,
            periodStart: new Date(start).toISOString(),
            periodEnd: new Date(`${end}T23:59:59`).toISOString(),
            closeType: 'MANUAL',
          },
        },
      })
      toast.success('Cierre manual creado como borrador.')
      setShowForm(false)
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear el cierre.')
    } finally {
      setCreatingMode(null)
    }
  }

  const handleRecalc = async (id: string) => {
    setRecalcingId(id)
    try {
      await recalcClose({ variables: { id } })
      toast.success('Snapshot recalculado.')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al recalcular.')
    } finally {
      setRecalcingId(null)
    }
  }

  const handleConfirm = async () => {
    if (!confirmId) return
    try {
      await confirmClose({ variables: { id: confirmId } })
      toast.success('Cierre confirmado. Los datos quedan inmutables.')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al confirmar.')
    } finally {
      setConfirmId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteClose({ variables: { id: deleteId } })
      toast.success('Borrador eliminado.')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar.')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Cierres de período</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Los cierres mensuales son el registro oficial. Los manuales sirven para cálculos puntuales.
          </p>
        </div>
        {stationId && (
          <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm(v => !v)}>
            <Plus className="size-4" />
            {showForm ? 'Cancelar' : 'Nuevo cierre'}
          </Button>
        )}
      </div>

      {!stationId && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          Selecciona una estación en el selector de arriba.
        </div>
      )}

      {/* New close form panel */}
      {stationId && showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              <button
                onClick={() => setMode('MONTHLY')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === 'MONTHLY'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Calendar className="size-3.5" />
                Mensual
              </button>
              <button
                onClick={() => setMode('MANUAL')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === 'MANUAL'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <CalendarDays className="size-3.5" />
                Manual
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {mode === 'MONTHLY' && (
              <MonthlyCloseForm
                stationId={stationId}
                closes={closes}
                onCreated={handleCreateMonthly}
                onRecalc={handleRecalc}
                creating={creatingMode === 'MONTHLY'}
                recalcing={!!recalcingId}
              />
            )}
            {mode === 'MANUAL' && (
              <ManualCloseForm
                onCreated={handleCreateManual}
                creating={creatingMode === 'MANUAL'}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* List */}
      {stationId && !loading && sortedCloses.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          No hay cierres registrados para esta estación.
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando cierres…
        </div>
      )}

      <div className="space-y-3">
        {sortedCloses.map((close) => (
          <CloseCard
            key={close.id}
            close={close}
            expanded={expandedId === close.id}
            onToggle={() => setExpandedId(expandedId === close.id ? null : close.id)}
            onConfirm={() => setConfirmId(close.id)}
            onRecalc={() => handleRecalc(close.id)}
            onDelete={() => setDeleteId(close.id)}
            recalcing={recalcingId === close.id}
          />
        ))}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cierre?</AlertDialogTitle>
            <AlertDialogDescription>
              El snapshot quedará inmutable. No se podrá recalcular ni eliminar. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar cierre</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se pueden eliminar cierres en estado Borrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
