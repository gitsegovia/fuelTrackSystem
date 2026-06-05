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

interface ShiftFinancialRow {
  shift: {
    id: string
    employeeRole: string
    shiftStartTime: string
    shiftEndTime?: string
    employee: { firstName: string; lastName: string }
  }
  totalExpectedAmount: string
  totalCollectedAmount: string
  financialDifferential: string
  cashAmount: string
  electronicAmount: string
  totalTickets: number
  completedTickets: number
  canceledTickets: number
  pendingTickets: number
}

const columns: ColumnDef<ShiftFinancialRow>[] = [
  {
    id: 'cajero',
    header: 'Cajero',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.shift.employee.firstName} {row.original.shift.employee.lastName}</p>
        <p className="text-xs text-muted-foreground">{row.original.shift.employeeRole}</p>
      </div>
    ),
  },
  {
    id: 'turno',
    header: 'Turno',
    cell: ({ row }) => (
      <div className="text-xs">
        <p>{format(new Date(row.original.shift.shiftStartTime), 'dd/MM/yy HH:mm', { locale: es })}</p>
        {row.original.shift.shiftEndTime
          ? <p className="text-muted-foreground">→ {format(new Date(row.original.shift.shiftEndTime), 'HH:mm', { locale: es })}</p>
          : <p className="text-amber-500">Activo</p>
        }
      </div>
    ),
  },
  {
    accessorKey: 'totalExpectedAmount',
    header: 'Esperado',
    cell: ({ getValue }) => <span className="font-mono">{parseFloat(getValue() as string).toFixed(2)}</span>,
  },
  {
    accessorKey: 'totalCollectedAmount',
    header: 'Cobrado',
    cell: ({ getValue }) => <span className="font-mono font-medium">{parseFloat(getValue() as string).toFixed(2)}</span>,
  },
  {
    id: 'diferencial',
    header: 'Diferencial',
    cell: ({ row }) => {
      const num = parseFloat(row.original.financialDifferential)
      const color = Math.abs(num) < 0.01 ? '' : num < 0 ? 'text-destructive' : 'text-emerald-600'
      return (
        <span className={`font-mono font-medium ${color}`}>
          {num > 0 ? '+' : ''}{num.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: 'metodos',
    header: 'Efectivo / Electrónico',
    cell: ({ row }) => (
      <div className="text-xs font-mono space-y-0.5">
        <p>💵 {parseFloat(row.original.cashAmount).toFixed(2)}</p>
        <p>💳 {parseFloat(row.original.electronicAmount).toFixed(2)}</p>
      </div>
    ),
  },
  {
    id: 'tickets',
    header: 'Tickets',
    cell: ({ row }) => (
      <div className="text-xs space-y-0.5">
        <p>Total: <strong>{row.original.totalTickets}</strong></p>
        <p className="text-emerald-600">✓ {row.original.completedTickets}</p>
        {row.original.canceledTickets > 0 && (
          <p className="text-destructive">✕ {row.original.canceledTickets}</p>
        )}
        {row.original.pendingTickets > 0 && (
          <p className="text-amber-500">⏳ {row.original.pendingTickets}</p>
        )}
      </div>
    ),
  },
  {
    id: 'estado',
    header: 'Estado',
    cell: ({ row }) => {
      const diff = Math.abs(parseFloat(row.original.financialDifferential))
      const pending = row.original.pendingTickets
      if (pending > 0) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Tickets pendientes</Badge>
      if (diff > 1) return <Badge variant="destructive">Descuadre</Badge>
      return <Badge variant="outline" className="text-emerald-700 border-emerald-200">Cuadrado</Badge>
    },
  },
]

function todayISO() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function FinancieroAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const { data, loading } = useQuery<{ shiftFinancialAudit: ShiftFinancialRow[] }>(
    QUERIES.shiftFinancialAudit,
    {
      variables: {
        gasStationId,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
      },
      skip: !gasStationId,
    }
  )

  const rows = data?.shiftFinancialAudit ?? []

  const totalExpected = rows.reduce((s, r) => s + parseFloat(r.totalExpectedAmount), 0)
  const totalCollected = rows.reduce((s, r) => s + parseFloat(r.totalCollectedAmount), 0)
  const totalDiff = totalCollected - totalExpected
  const unclosedShifts = rows.filter((r) => r.pendingTickets > 0).length

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
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total esperado</p>
          <p className="text-2xl font-bold font-mono">{totalExpected.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total cobrado</p>
          <p className="text-2xl font-bold font-mono">{totalCollected.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Diferencial global</p>
          <p className={`text-2xl font-bold font-mono ${totalDiff < -0.01 ? 'text-destructive' : totalDiff > 0.01 ? 'text-emerald-600' : ''}`}>
            {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Turnos con tickets pendientes</p>
          <p className={`text-2xl font-bold ${unclosedShifts > 0 ? 'text-amber-500' : ''}`}>{unclosedShifts}</p>
        </div>
      </div>

      <DataTable columns={columns} data={rows} loading={loading} />
    </div>
  )
}
