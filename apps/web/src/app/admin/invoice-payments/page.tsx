'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { CreditCard, TrendingUp, AlertCircle, CheckCircle2, Eye } from 'lucide-react'
import { QUERIES } from '@/services/graphql/gql/invoicePayment'
import { QUERIES as GAS_STATION_QUERIES } from '@/services/graphql/gql/gasStation'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ColumnDef } from '@tanstack/react-table'

const FUEL_KIND_LABELS: Record<string, string> = {
  GASOLINE_91: 'Gasolina 91',
  GASOLINE_95: 'Gasolina 95',
  DIESEL: 'Diésel',
  KEROSENE: 'Kerosene',
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', className: 'text-destructive border-destructive/40 bg-destructive/5' },
  PARTIAL: { label: 'Parcial', className: 'text-amber-600 border-amber-500/40 bg-amber-50' },
  PAID: { label: 'Pagada', className: 'text-emerald-600 border-emerald-500/40 bg-emerald-50' },
}

type GasStation = { id: string; name: string; code: string }

type InvoiceBalance = {
  totalAmount: string
  totalPaid: string
  balance: string
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID'
  invoice: {
    id: string
    invoiceNumber: string
    fuelKind: string
    totalAmount: string
    dispatchDate: string
    status: string
    receivingGasStation: { id: string; name: string }
    currency: { id: string; name: string; symbol: string }
  }
  payments: { id: string }[]
}

type ProfitMargin = {
  totalRevenue: string
  totalInvoicedCost: string
  totalPaidCost: string
  grossMargin: string
  grossMarginPercent: string
  pendingInvoicesAmount: string
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  highlight?: 'positive' | 'warning' | 'neutral'
}) {
  const colors = {
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    neutral: 'text-primary',
  }
  return (
    <div className="rounded-xl border bg-card p-5 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className={cn('size-4', highlight ? colors[highlight] : '')} />
        {label}
      </div>
      <p className={cn('text-2xl font-bold tracking-tight', highlight ? colors[highlight] : '')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function fmt(val: string | number | undefined, symbol = '') {
  const n = parseFloat(String(val ?? 0))
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
)

export default function InvoicePaymentsPage() {
  const router = useRouter()
  const now = new Date()
  const [gasStationId, setGasStationId] = useState('')
  const [monthStr, setMonthStr] = useState(format(now, 'yyyy-MM'))

  const { startDate, endDate } = useMemo(() => {
    const d = new Date(`${monthStr}-01`)
    return {
      startDate: startOfMonth(d).toISOString(),
      endDate: endOfMonth(d).toISOString(),
    }
  }, [monthStr])

  const { data: stationsData } = useQuery<{ gasStations: GasStation[] }>(GAS_STATION_QUERIES.gasStations)
  const stations = stationsData?.gasStations ?? []

  const selectedStation = stations.find((s) => s.id === gasStationId)

  const { data: unpaidData, loading: unpaidLoading } = useQuery<{ unpaidInvoices: InvoiceBalance[] }>(
    QUERIES.unpaidInvoices,
    { variables: { gasStationId }, skip: !gasStationId }
  )

  const { data: marginData } = useQuery<{ invoiceProfitMargin: ProfitMargin }>(
    QUERIES.invoiceProfitMargin,
    { variables: { gasStationId, startDate, endDate }, skip: !gasStationId }
  )

  const margin = marginData?.invoiceProfitMargin
  const unpaid = unpaidData?.unpaidInvoices ?? []
  const currencySymbol = unpaid[0]?.invoice.currency.symbol ?? ''

  const columns: ColumnDef<InvoiceBalance>[] = [
    { accessorKey: 'invoice.invoiceNumber', header: 'N° Factura', cell: ({ row }) => row.original.invoice.invoiceNumber },
    { header: 'Combustible', cell: ({ row }) => FUEL_KIND_LABELS[row.original.invoice.fuelKind] ?? row.original.invoice.fuelKind },
    {
      header: 'Fecha',
      cell: ({ row }) => format(new Date(row.original.invoice.dispatchDate), 'dd/MM/yyyy', { locale: es }),
    },
    {
      header: 'Total factura',
      cell: ({ row }) => fmt(row.original.totalAmount, `${row.original.invoice.currency.symbol} `),
    },
    {
      header: 'Pagado',
      cell: ({ row }) => (
        <span className="text-emerald-600 font-medium">
          {fmt(row.original.totalPaid, `${row.original.invoice.currency.symbol} `)}
        </span>
      ),
    },
    {
      header: 'Saldo',
      cell: ({ row }) => (
        <span className="text-destructive font-semibold">
          {fmt(row.original.balance, `${row.original.invoice.currency.symbol} `)}
        </span>
      ),
    },
    {
      header: 'Pagos',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.payments.length}</span>
      ),
    },
    {
      header: 'Estado',
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.paymentStatus]
        return (
          <Badge variant="outline" className={cfg.className}>
            {cfg.label}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          title="Ver pagos"
          onClick={() => router.push(`/admin/invoice-payments/${row.original.invoice.id}`)}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos de Facturas"
        description="Control de cuentas por pagar, trazabilidad bancaria y margen operacional"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5 min-w-48">
          <Label className="text-xs text-muted-foreground">Estación</Label>
          <select
            value={gasStationId}
            onChange={(e) => setGasStationId(e.target.value)}
            className={selectClass}
          >
            <option value="">Seleccionar estación…</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mes (KPIs)</Label>
          <Input
            type="month"
            value={monthStr}
            onChange={(e) => setMonthStr(e.target.value)}
            className="h-8 w-36"
          />
        </div>
      </div>

      {!gasStationId && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
          Selecciona una estación para ver los datos de pago.
        </div>
      )}

      {gasStationId && (
        <>
          {/* KPI cards */}
          {margin && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Ingresos del mes"
                value={fmt(margin.totalRevenue, `${currencySymbol} `)}
                icon={TrendingUp}
                highlight="positive"
              />
              <KpiCard
                label="Costo pagado"
                value={fmt(margin.totalPaidCost, `${currencySymbol} `)}
                sub={`Facturado: ${fmt(margin.totalInvoicedCost, `${currencySymbol} `)}`}
                icon={CreditCard}
                highlight="neutral"
              />
              <KpiCard
                label="Margen bruto"
                value={fmt(margin.grossMargin, `${currencySymbol} `)}
                sub={`${parseFloat(margin.grossMarginPercent).toFixed(1)}% de los ingresos`}
                icon={TrendingUp}
                highlight={parseFloat(margin.grossMargin) >= 0 ? 'positive' : 'warning'}
              />
              <KpiCard
                label="Facturas pendientes"
                value={fmt(margin.pendingInvoicesAmount, `${currencySymbol} `)}
                sub="Por pagar en todas las fechas"
                icon={AlertCircle}
                highlight={parseFloat(margin.pendingInvoicesAmount) > 0 ? 'warning' : 'positive'}
              />
            </div>
          )}

          {/* Unpaid/partial invoices table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                Facturas con saldo pendiente
                {selectedStation && (
                  <span className="font-normal text-muted-foreground"> — {selectedStation.name}</span>
                )}
              </h2>
              {!unpaidLoading && unpaid.length === 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="size-3.5" /> Todo pagado
                </span>
              )}
            </div>
            <DataTable columns={columns} data={unpaid} loading={unpaidLoading} />
          </div>
        </>
      )}
    </div>
  )
}
