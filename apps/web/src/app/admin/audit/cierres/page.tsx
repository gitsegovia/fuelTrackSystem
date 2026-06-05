'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Lock, RefreshCw, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/auditPeriodClose'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91', GASOLINE_95: 'Gasolina 95', DIESEL: 'Diésel', KEROSENE: 'Kerosene',
}

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
)

const schema = z.object({
  periodStart: z.string().min(1, 'Requerido'),
  periodEnd: z.string().min(1, 'Requerido'),
  closeType: z.enum(['MONTHLY', 'MANUAL']),
})

type FormData = z.infer<typeof schema>

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

function fmt(v: number | null | undefined, dec = 2) {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function DiffBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>
  const color = value < -0.01 ? 'text-destructive' : value > 0.01 ? 'text-emerald-600' : 'text-muted-foreground'
  return <span className={cn('font-medium', color)}>{value > 0 ? '+' : ''}{fmt(value)} L</span>
}

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
        { label: 'Ingresos (ventas)', value: `${fmt(data.totalRevenue)}` },
        { label: 'Costo facturado', value: `${fmt(data.totalInvoicedCost)}` },
        { label: 'Costo pagado', value: `${fmt(data.totalPaidCost)}` },
        { label: 'Facturas pendientes', value: `${fmt(data.pendingInvoicesAmount)}` },
        { label: 'Margen bruto', value: `${fmt(data.grossMargin)}`, highlight: true },
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
    QUERIES.auditPeriodClose,
    { variables: { id: closeId } }
  )
  const [activeTab, setActiveTab] = useState<'invoices' | 'margin' | 'drivers'>('invoices')

  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando snapshot…</div>
  const c = data?.auditPeriodClose
  if (!c) return null

  const tabs = [
    { key: 'invoices' as const, label: 'Recepciones' },
    { key: 'margin' as const, label: 'Margen' },
    { key: 'drivers' as const, label: 'Choferes' },
  ]

  return (
    <div className="border-t pt-4 mt-2 space-y-3">
      <div className="flex gap-1">
        {tabs.map(({ key, label }) => (
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
            : <table className="w-full text-xs">
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
        )}
      </div>
    </div>
  )
}

export default function AuditCierresPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const stationId = searchParams.get('stationId') ?? ''
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery<{ auditPeriodCloses: AuditPeriodClose[] }>(
    QUERIES.auditPeriodCloses,
    { variables: { gasStationId: stationId }, skip: !stationId }
  )

  const [createClose, { loading: creating }] = useMutation(MUTATIONS.createAuditPeriodClose)
  const [confirmClose, { loading: confirming }] = useMutation(MUTATIONS.confirmAuditPeriodClose)
  const [recalcClose, { loading: recalcing }] = useMutation(MUTATIONS.recalculateAuditPeriodClose)
  const [deleteClose] = useMutation(MUTATIONS.deleteAuditPeriodClose)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { closeType: 'MANUAL' },
  })

  const closes = data?.auditPeriodCloses ?? []

  const onSubmit = async (values: FormData) => {
    if (!user || !stationId) return
    try {
      await createClose({
        variables: {
          input: {
            gasStationId: stationId,
            closedById: user.id,
            periodStart: new Date(values.periodStart).toISOString(),
            periodEnd: new Date(`${values.periodEnd}T23:59:59`).toISOString(),
            closeType: values.closeType,
          },
        },
      })
      toast.success('Cierre de período creado como borrador.')
      reset({ closeType: 'MANUAL' })
      setShowForm(false)
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear el cierre.')
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

  const handleRecalc = async (id: string) => {
    try {
      await recalcClose({ variables: { id } })
      toast.success('Snapshot recalculado.')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al recalcular.')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteClose({ variables: { id: deleteId } })
      toast.success('Cierre eliminado.')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar.')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Cierres de período</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Snapshots inmutables de las 6 dimensiones de auditoría para un rango de fechas dado.
          </p>
        </div>
        {stationId && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="size-4" />
            {showForm ? 'Cancelar' : 'Nuevo cierre'}
          </Button>
        )}
      </div>

      {!stationId && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          Selecciona una estación en el selector de arriba para ver los cierres.
        </div>
      )}

      {stationId && showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nuevo cierre de período</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cierre</Label>
                <select {...register('closeType')} className={selectClass}>
                  <option value="MANUAL">Manual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>
              <Button type="submit" size="sm" disabled={creating} className="self-end">
                {creating && <Loader2 className="size-4 animate-spin mr-1" />}
                Calcular y guardar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {stationId && !loading && closes.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          No hay cierres de período para esta estación.
        </div>
      )}

      <div className="space-y-3">
        {closes.map((close) => {
          const expanded = expandedId === close.id
          const isDraft = close.status === 'DRAFT'
          const s = close.summary

          return (
            <Card key={close.id} className={cn('transition-colors', isDraft && 'border-amber-400/40')}>
              <CardHeader className="pb-0 pt-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Left: dates + meta */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(expanded ? null : close.id)}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
                    >
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      {format(new Date(close.periodStart), 'd MMM yyyy', { locale: es })}
                      {' — '}
                      {format(new Date(close.periodEnd), 'd MMM yyyy', { locale: es })}
                    </button>
                    <Badge
                      variant="outline"
                      className={isDraft
                        ? 'text-amber-600 border-amber-500/40 bg-amber-50'
                        : 'text-emerald-600 border-emerald-500/40 bg-emerald-50'
                      }
                    >
                      {isDraft ? 'Borrador' : 'Confirmado'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {close.closeType === 'MONTHLY' ? 'Mensual' : 'Manual'} · por {close.closedBy.username}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isDraft && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Recalcular snapshot"
                          onClick={() => handleRecalc(close.id)}
                          disabled={recalcing}
                        >
                          <RefreshCw className={cn('size-4', recalcing && 'animate-spin')} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Confirmar cierre (inmutable)"
                          onClick={() => setConfirmId(close.id)}
                        >
                          <Lock className="size-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar borrador"
                          onClick={() => setDeleteId(close.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* KPI row */}
                <div className="flex flex-wrap gap-6 pt-3 pb-1 text-xs text-muted-foreground">
                  <span>{s.invoiceCount} facturas · <span className="text-foreground font-medium">{fmt(s.totalInvoicedLiters)} L</span> facturados</span>
                  <span>Diferencial: <DiffBadge value={s.invoiceDifferential} /></span>
                  <span>{s.shiftCount} turnos</span>
                  {s.grossMargin !== null && (
                    <span>
                      Margen: <span className={cn('font-medium', s.grossMargin >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                        {fmt(s.grossMargin)} ({fmt(s.grossMarginPercent, 1)}%)
                      </span>
                    </span>
                  )}
                  {s.pendingInvoicesAmount !== null && s.pendingInvoicesAmount > 0 && (
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
        })}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cierre?</AlertDialogTitle>
            <AlertDialogDescription>
              El snapshot quedará inmutable. No se podrá recalcular ni eliminar el cierre. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Confirmando…' : 'Confirmar cierre'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador de cierre. Solo se pueden eliminar cierres en estado Borrador.
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
