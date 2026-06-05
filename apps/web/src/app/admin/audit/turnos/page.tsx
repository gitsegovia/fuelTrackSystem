'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useSearchParams } from 'next/navigation'
import { QUERIES } from '@/services/graphql/gql/audit'
import { DataTable } from '@/components/shared/DataTable'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ShiftAuditRow {
  shift: {
    id: string
    employeeRole: string
    shiftStartTime: string
    shiftEndTime?: string
    employee: { firstName: string; lastName: string }
  }
  meterDeltaLiters: string | null
  cashierTicketLiters: string | null
  tankMeasurementLiters: string | null
  meterVsCashierDiff: string | null
  cashierVsTankDiff: string | null
  meterVsTankDiff: string | null
  totalTickets: number
  canceledTickets: number
}

function DiffCell({ value }: { value: string | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">sin datos</span>
  const num = parseFloat(value)
  if (Math.abs(num) < 0.01) return <Badge variant="outline" className="text-xs font-mono">0.00</Badge>
  const color = num < 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return (
    <Badge variant="outline" className={`text-xs font-mono ${color}`}>
      {num > 0 ? '+' : ''}{num.toFixed(2)} L
    </Badge>
  )
}

function LitersCell({ value }: { value: string | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>
  return <span className="font-mono text-sm">{parseFloat(value).toFixed(2)}</span>
}

const columns: ColumnDef<ShiftAuditRow>[] = [
  {
    id: 'empleado',
    header: 'Empleado',
    cell: ({ row }) => {
      const { firstName, lastName } = row.original.shift.employee
      return <span className="font-medium">{firstName} {lastName}</span>
    },
  },
  {
    id: 'rol',
    header: 'Rol',
    cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.shift.employeeRole}</Badge>,
  },
  {
    id: 'inicio',
    header: 'Inicio',
    cell: ({ row }) => format(new Date(row.original.shift.shiftStartTime), 'dd/MM/yy HH:mm', { locale: es }),
  },
  {
    id: 'fin',
    header: 'Fin',
    cell: ({ row }) => row.original.shift.shiftEndTime
      ? format(new Date(row.original.shift.shiftEndTime), 'HH:mm', { locale: es })
      : <span className="text-amber-500 text-xs">Activo</span>,
  },
  {
    id: 'medidor',
    header: 'Medidor (L)',
    cell: ({ row }) => <LitersCell value={row.original.meterDeltaLiters} />,
  },
  {
    id: 'cajero',
    header: 'Cajero (L)',
    cell: ({ row }) => <LitersCell value={row.original.cashierTicketLiters} />,
  },
  {
    id: 'tanque',
    header: 'Tanque (L)',
    cell: ({ row }) => <LitersCell value={row.original.tankMeasurementLiters} />,
  },
  {
    id: 'med_vs_caj',
    header: 'Medidor − Cajero',
    cell: ({ row }) => <DiffCell value={row.original.meterVsCashierDiff} />,
  },
  {
    id: 'caj_vs_tan',
    header: 'Cajero − Tanque',
    cell: ({ row }) => <DiffCell value={row.original.cashierVsTankDiff} />,
  },
  {
    id: 'med_vs_tan',
    header: 'Medidor − Tanque',
    cell: ({ row }) => <DiffCell value={row.original.meterVsTankDiff} />,
  },
  {
    id: 'tickets',
    header: 'Tickets',
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.totalTickets}
        {row.original.canceledTickets > 0 && (
          <span className="text-destructive ml-1">(-{row.original.canceledTickets})</span>
        )}
      </span>
    ),
  },
]

function todayISO() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function TurnosAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const { data, loading } = useQuery<{ shiftAudit: ShiftAuditRow[] }>(
    QUERIES.shiftAudit,
    {
      variables: {
        gasStationId,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
      },
      skip: !gasStationId,
    }
  )

  const rows = data?.shiftAudit ?? []

  // KPIs
  const withData = rows.filter((r) => r.meterVsCashierDiff !== null)
  const avgMeterCashier = withData.length
    ? withData.reduce((s, r) => s + parseFloat(r.meterVsCashierDiff!), 0) / withData.length
    : 0
  const withTankData = rows.filter((r) => r.cashierVsTankDiff !== null)
  const avgCashierTank = withTankData.length
    ? withTankData.reduce((s, r) => s + parseFloat(r.cashierVsTankDiff!), 0) / withTankData.length
    : 0

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
          <p className="text-xs text-muted-foreground">Turnos analizados</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Promedio Medidor − Cajero</p>
          <p className={`text-2xl font-bold font-mono ${avgMeterCashier < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {avgMeterCashier > 0 ? '+' : ''}{avgMeterCashier.toFixed(2)} L
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Promedio Cajero − Tanque</p>
          <p className={`text-2xl font-bold font-mono ${avgCashierTank < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {avgCashierTank > 0 ? '+' : ''}{avgCashierTank.toFixed(2)} L
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Medidor − Cajero</strong>: diferencia entre lo que registró el contador del surtidor y lo que registró el cajero en tickets. &nbsp;
        <strong>Cajero − Tanque</strong>: diferencia entre los tickets del cajero y la medición física del tanque al cierre.
      </p>

      <DataTable columns={columns} data={rows} loading={loading} />
    </div>
  )
}
