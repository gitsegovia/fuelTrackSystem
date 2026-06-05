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

interface DispatcherAuditRow {
  employee: { id: string; firstName: string; lastName: string; position: string }
  totalTickets: number
  totalRequestedLiters: string
  totalDispatchedLiters: string
  totalDifferential: string
  avgDifferentialPerTicket: string
  shortTickets: number
  excessTickets: number
  shortTicketPercent: string
}

const columns: ColumnDef<DispatcherAuditRow>[] = [
  {
    id: 'empleado',
    header: 'Bombero',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.employee.firstName} {row.original.employee.lastName}</p>
        <p className="text-xs text-muted-foreground">{row.original.employee.position}</p>
      </div>
    ),
  },
  { accessorKey: 'totalTickets', header: 'Tickets' },
  {
    accessorKey: 'totalRequestedLiters',
    header: 'Solicitado (L)',
    cell: ({ getValue }) => parseFloat(getValue() as string).toFixed(2),
  },
  {
    accessorKey: 'totalDispatchedLiters',
    header: 'Despachado (L)',
    cell: ({ getValue }) => parseFloat(getValue() as string).toFixed(2),
  },
  {
    id: 'diferencial',
    header: 'Diferencial total',
    cell: ({ row }) => {
      const num = parseFloat(row.original.totalDifferential)
      const color = num < 0 ? 'text-destructive' : num > 0 ? 'text-emerald-600' : ''
      return (
        <span className={`font-mono font-medium ${color}`}>
          {num > 0 ? '+' : ''}{num.toFixed(2)} L
        </span>
      )
    },
  },
  {
    accessorKey: 'avgDifferentialPerTicket',
    header: 'Prom. por ticket',
    cell: ({ getValue }) => {
      const num = parseFloat(getValue() as string)
      const color = num < 0 ? 'text-destructive' : num > 0 ? 'text-emerald-600' : ''
      return <span className={`font-mono text-sm ${color}`}>{num > 0 ? '+' : ''}{num.toFixed(3)} L</span>
    },
  },
  {
    id: 'mermas',
    header: 'Faltantes',
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <p className="text-destructive font-medium">{row.original.shortTickets} tickets</p>
        <p className="text-xs text-muted-foreground">{parseFloat(row.original.shortTicketPercent).toFixed(1)}% del total</p>
      </div>
    ),
  },
  {
    id: 'excedentes',
    header: 'Excedentes',
    cell: ({ row }) => (
      <span className="text-emerald-600 font-medium">{row.original.excessTickets} tickets</span>
    ),
  },
  {
    id: 'tendencia',
    header: 'Tendencia',
    cell: ({ row }) => {
      const shortPct = parseFloat(row.original.shortTicketPercent)
      if (shortPct > 30) return <Badge variant="destructive">Alto riesgo</Badge>
      if (shortPct > 15) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Observar</Badge>
      return <Badge variant="outline" className="text-emerald-700 border-emerald-200">Normal</Badge>
    },
  },
]

function todayISO() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function BomberosAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const { data, loading } = useQuery<{ dispatcherAudit: DispatcherAuditRow[] }>(
    QUERIES.dispatcherAudit,
    {
      variables: {
        gasStationId,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
      },
      skip: !gasStationId,
    }
  )

  const rows = data?.dispatcherAudit ?? []

  const worstDiff = rows.length ? Math.min(...rows.map((r) => parseFloat(r.totalDifferential))) : 0
  const highRisk = rows.filter((r) => parseFloat(r.shortTicketPercent) > 30).length

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
          <p className="text-xs text-muted-foreground">Bomberos analizados</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Mayor merma acumulada</p>
          <p className={`text-2xl font-bold font-mono ${worstDiff < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {worstDiff > 0 ? '+' : ''}{worstDiff.toFixed(2)} L
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Bomberos en alto riesgo (&gt;30% faltante)</p>
          <p className={`text-2xl font-bold ${highRisk > 0 ? 'text-destructive' : ''}`}>{highRisk}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Ordenado por diferencial total acumulado. El <strong>diferencial</strong> es la diferencia entre los litros que el cajero autorizó y los que el bombero efectivamente despachó.
        Un valor negativo indica que el bombero despachó menos de lo solicitado.
      </p>

      <DataTable columns={columns} data={rows} loading={loading} />
    </div>
  )
}
