'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/invoicePayment'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DataTable } from '@/components/shared/DataTable'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { ColumnDef } from '@tanstack/react-table'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91',
  GASOLINE_95: 'Gasolina 95',
  DIESEL: 'Diésel',
  KEROSENE: 'Kerosene',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia bancaria',
  CHECK: 'Cheque',
  CARD: 'Tarjeta',
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', className: 'text-destructive border-destructive/40 bg-destructive/5' },
  PARTIAL: { label: 'Pago parcial', className: 'text-amber-600 border-amber-500/40 bg-amber-50' },
  PAID: { label: 'Pagada', className: 'text-emerald-600 border-emerald-500/40 bg-emerald-50' },
}

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  amount: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    'Debe ser mayor a 0'
  ),
  paymentDate: z.string().min(1, 'Requerido'),
  bankName: z.string().min(1, 'Requerido'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type InvoicePayment = {
  id: string
  amount: string
  paymentDate: string
  bankName: string
  paymentMethod: string
  referenceNumber?: string
  notes?: string
  createdAt: string
  recordedBy: { id: string; username: string }
}

type InvoiceBalance = {
  totalAmount: string
  totalPaid: string
  balance: string
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID'
  invoice: {
    id: string
    invoiceNumber: string
    controlNumber: string
    fuelKind: string
    totalAmount: string
    costPerLiter: string
    liters: string
    dispatchDate: string
    status: string
    receivingGasStation: { id: string; name: string }
    currency: { id: string; name: string; symbol: string }
  }
  payments: InvoicePayment[]
}

function fmt(val: string | number | undefined, symbol = '') {
  const n = parseFloat(String(val ?? 0))
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function InvoicePaymentDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, loading, refetch } = useQuery<{ invoiceBalance: InvoiceBalance }>(
    QUERIES.invoiceBalance,
    { variables: { invoiceId }, skip: !invoiceId }
  )

  const [createPayment, { loading: creating }] = useMutation(MUTATIONS.createInvoicePayment)
  const [deletePayment] = useMutation(MUTATIONS.deleteInvoicePayment)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const balance = data?.invoiceBalance
  const inv = balance?.invoice
  const symbol = inv?.currency.symbol ?? ''

  const columns: ColumnDef<InvoicePayment>[] = [
    {
      header: 'Fecha',
      cell: ({ row }) => format(new Date(row.original.paymentDate), 'dd/MM/yyyy', { locale: es }),
    },
    { header: 'Banco / Entidad', cell: ({ row }) => row.original.bankName },
    { header: 'Método', cell: ({ row }) => PAYMENT_METHOD_LABELS[row.original.paymentMethod] ?? row.original.paymentMethod },
    { header: 'Referencia', cell: ({ row }) => row.original.referenceNumber ?? '—' },
    {
      header: 'Monto',
      cell: ({ row }) => (
        <span className="font-semibold text-emerald-700">{fmt(row.original.amount, `${symbol} `)}</span>
      ),
    },
    { header: 'Registrado por', cell: ({ row }) => row.original.recordedBy.username },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      ),
    },
  ]

  const onSubmit = async (values: FormData) => {
    if (!user) return
    try {
      await createPayment({
        variables: {
          input: {
            invoiceId,
            amount: parseFloat(values.amount),
            paymentDate: new Date(values.paymentDate).toISOString(),
            bankName: values.bankName,
            paymentMethod: values.paymentMethod,
            referenceNumber: values.referenceNumber || null,
            notes: values.notes || null,
            recordedById: user.id,
          },
        },
      })
      toast.success('Pago registrado.')
      reset({ paymentMethod: 'BANK_TRANSFER', paymentDate: format(new Date(), 'yyyy-MM-dd') })
      setShowForm(false)
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo registrar el pago.')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deletePayment({ variables: { id: deleteId } })
      toast.success('Pago eliminado.')
      refetch()
    } catch {
      toast.error('No se pudo eliminar el pago.')
    } finally {
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
        <Loader2 className="size-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (!balance || !inv) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> Volver
        </Button>
        <p className="text-muted-foreground text-sm">Factura no encontrada.</p>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[balance.paymentStatus]
  const paidPct = parseFloat(balance.totalAmount) > 0
    ? Math.min(100, (parseFloat(balance.totalPaid) / parseFloat(balance.totalAmount)) * 100)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pagos — Factura ${inv.invoiceNumber}`}
        description={`${inv.receivingGasStation.name} · ${FUEL_KIND_LABELS[inv.fuelKind] ?? inv.fuelKind} · ${format(new Date(inv.dispatchDate), 'dd MMM yyyy', { locale: es })}`}
        action={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/invoice-payments')}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {/* Balance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total factura</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmt(balance.totalAmount, `${symbol} `)}</p>
            <p className="text-xs text-muted-foreground mt-1">{parseFloat(inv.liters).toLocaleString()} L · {fmt(inv.costPerLiter, `${symbol} `)}/L</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-600">{fmt(balance.totalPaid, `${symbol} `)}</p>
            <p className="text-xs text-muted-foreground mt-1">{paidPct.toFixed(1)}% cubierto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-xl font-bold', parseFloat(balance.balance) > 0 ? 'text-destructive' : 'text-emerald-600')}>
              {fmt(balance.balance, `${symbol} `)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{balance.payments.length} pago{balance.payments.length !== 1 ? 's' : ''} registrado{balance.payments.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <Badge variant="outline" className={cn('text-sm px-3 py-1', statusCfg.className)}>
              {balance.paymentStatus === 'PAID' && <CheckCircle2 className="size-3.5 mr-1.5" />}
              {statusCfg.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Payment history table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Historial de pagos</h2>
          {balance.paymentStatus !== 'PAID' && (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="size-4" />
              {showForm ? 'Cancelar' : 'Registrar pago'}
            </Button>
          )}
        </div>

        {/* Inline payment form */}
        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Nuevo pago</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Monto <span className="text-destructive">*</span></Label>
                  <Input {...register('amount')} type="number" step="0.01" placeholder="0.00" className="h-8" aria-invalid={!!errors.amount} />
                  {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha de pago <span className="text-destructive">*</span></Label>
                  <Input {...register('paymentDate')} type="date" className="h-8" aria-invalid={!!errors.paymentDate} />
                  {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Banco / Entidad <span className="text-destructive">*</span></Label>
                  <Input {...register('bankName')} placeholder="Ej. Banco Nacional" className="h-8" aria-invalid={!!errors.bankName} />
                  {errors.bankName && <p className="text-xs text-destructive">{errors.bankName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Método de pago <span className="text-destructive">*</span></Label>
                  <select {...register('paymentMethod')} className={selectClass}>
                    <option value="BANK_TRANSFER">Transferencia bancaria</option>
                    <option value="CASH">Efectivo</option>
                    <option value="CHECK">Cheque</option>
                    <option value="CARD">Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">N° de referencia</Label>
                  <Input {...register('referenceNumber')} placeholder="Opcional" className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas</Label>
                  <Input {...register('notes')} placeholder="Opcional" className="h-8" />
                </div>
                <div className="col-span-2 lg:col-span-3 flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={creating}>
                    {creating && <Loader2 className="size-4 animate-spin mr-1" />}
                    Registrar pago
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <DataTable columns={columns} data={balance.payments} loading={loading} />
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
