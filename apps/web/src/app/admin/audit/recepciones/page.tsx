'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useSearchParams } from 'next/navigation'
import { QUERIES } from '@/services/graphql/gql/audit'
import { DataTable } from '@/components/shared/DataTable'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface InvoiceAuditRow {
  invoiceId: string
  invoiceNumber: string
  controlNumber: string
  dispatchDate: string
  driverName: string
  driverIdNumber: string
  truckPlate: string
  tankPlate: string
  fuelKind: string
  invoicedLiters: string
  receivedLiters: string
  differential: string
  differentialPercent: string
  gasStation: { id: string; name: string; code: string }
}

interface DriverAuditSummary {
  driverName: string
  driverIdNumber: string
  truckPlate: string
  totalDeliveries: number
  totalInvoicedLiters: string
  totalReceivedLiters: string
  totalDifferential: string
  avgDifferentialPercent: string
  shortDeliveries: number
  excessDeliveries: number
}

function DiffBadge({ value, percent }: { value: string; percent?: string }) {
  const num = parseFloat(value)
  if (Math.abs(num) < 0.01) return <span className="text-muted-foreground text-sm">—</span>
  const color = num < 0 ? 'text-destructive' : 'text-emerald-600'
  const Icon = num < 0 ? TrendingDown : TrendingUp
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="size-3.5" />
      {num > 0 ? '+' : ''}{parseFloat(value).toFixed(2)} L
      {percent !== undefined && (
        <span className="text-xs opacity-75">({parseFloat(percent).toFixed(2)}%)</span>
      )}
    </span>
  )
}

const invoiceColumns: ColumnDef<InvoiceAuditRow>[] = [
  { accessorKey: 'invoiceNumber', header: 'Nº Factura' },
  {
    accessorKey: 'dispatchDate',
    header: 'Fecha',
    cell: ({ getValue }) => format(new Date(getValue() as string), 'dd/MM/yyyy', { locale: es }),
  },
  { accessorKey: 'driverName', header: 'Chofer' },
  { accessorKey: 'truckPlate', header: 'Placa camión' },
  { accessorKey: 'fuelKind', header: 'Combustible' },
  {
    accessorKey: 'invoicedLiters',
    header: 'Facturado (L)',
    cell: ({ getValue }) => parseFloat(getValue() as string).toFixed(2),
  },
  {
    accessorKey: 'receivedLiters',
    header: 'Recibido (L)',
    cell: ({ getValue }) => parseFloat(getValue() as string).toFixed(2),
  },
  {
    id: 'diferencial',
    header: 'Diferencial',
    cell: ({ row }) => (
      <DiffBadge value={row.original.differential} percent={row.original.differentialPercent} />
    ),
  },
  {
    accessorKey: 'gasStation',
    header: 'Estación',
    cell: ({ getValue }) => (getValue() as { name: string }).name,
  },
]

const driverColumns: ColumnDef<DriverAuditSummary>[] = [
  { accessorKey: 'driverName', header: 'Chofer' },
  { accessorKey: 'driverIdNumber', header: 'Cédula' },
  { accessorKey: 'truckPlate', header: 'Placa' },
  { accessorKey: 'totalDeliveries', header: 'Entregas' },
  {
    accessorKey: 'totalInvoicedLiters',
    header: 'Total facturado',
    cell: ({ getValue }) => `${parseFloat(getValue() as string).toFixed(0)} L`,
  },
  {
    accessorKey: 'totalReceivedLiters',
    header: 'Total recibido',
    cell: ({ getValue }) => `${parseFloat(getValue() as string).toFixed(0)} L`,
  },
  {
    id: 'diferencial',
    header: 'Diferencial acum.',
    cell: ({ row }) => (
      <DiffBadge value={row.original.totalDifferential} percent={row.original.avgDifferentialPercent} />
    ),
  },
  {
    id: 'mermasExcedentes',
    header: 'Mermas / Excedentes',
    cell: ({ row }) => (
      <span className="text-sm">
        <span className="text-destructive">{row.original.shortDeliveries}↓</span>
        {' / '}
        <span className="text-emerald-600">{row.original.excessDeliveries}↑</span>
      </span>
    ),
  },
]

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function thirtyDaysAgoISO() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

export default function RecepcionesAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const variables = {
    gasStationId,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
  }

  const { data: invoiceData, loading: invoiceLoading } = useQuery<{ invoiceAudit: InvoiceAuditRow[] }>(
    QUERIES.invoiceAudit,
    { variables, skip: !gasStationId }
  )

  const { data: driverData, loading: driverLoading } = useQuery<{ driverAuditSummary: DriverAuditSummary[] }>(
    QUERIES.driverAuditSummary,
    { variables: { gasStationId, startDate: variables.startDate, endDate: variables.endDate }, skip: !gasStationId }
  )

  const rows = invoiceData?.invoiceAudit ?? []
  const drivers = driverData?.driverAuditSummary ?? []

  const totalDiff = rows.reduce((s, r) => s + parseFloat(r.differential), 0)
  const shortCount = rows.filter((r) => parseFloat(r.differential) < -0.01).length
  const excessCount = rows.filter((r) => parseFloat(r.differential) > 0.01).length

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label htmlFor="startDate">Desde</Label>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">Hasta</Label>
          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Facturas analizadas</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Diferencial acumulado</p>
          <p className={`text-2xl font-bold ${totalDiff < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(2)} L
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Mermas / Excedentes</p>
          <p className="text-2xl font-bold">
            <span className="text-destructive">{shortCount}</span>
            <span className="text-muted-foreground text-lg"> / </span>
            <span className="text-emerald-600">{excessCount}</span>
          </p>
        </div>
      </div>

      {/* Tabla facturas */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detalle por factura</h2>
        <DataTable columns={invoiceColumns} data={rows} loading={invoiceLoading} />
      </div>

      {/* Ranking choferes */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ranking de choferes por diferencial</h2>
        <DataTable columns={driverColumns} data={drivers} loading={driverLoading} />
      </div>
    </div>
  )
}
