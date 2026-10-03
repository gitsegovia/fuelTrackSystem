'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useSearchParams } from 'next/navigation'
import { QUERIES } from '@/services/graphql/gql/audit'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { DataTable } from '@/components/shared/DataTable'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ColumnDef } from '@tanstack/react-table'

interface DifferentialRow {
  dispatcherEmployeeId: string
  ticketCount: number
  grossDifferentialLiters: string
  grossDifferentialAmount: string
  refundedLiters: string
  refundedAmount: string
  netDifferentialLiters: string
  netDifferentialAmount: string
}

interface EmployeeRow {
  id: string
  firstName: string
  lastName: string
  position: string
  gasStation: { id: string }
}

function signed(value: number, decimals: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`
}

function toneClass(value: number) {
  return value < 0 ? 'text-destructive' : value > 0 ? 'text-emerald-600' : ''
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function DiferencialAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const { data, loading } = useQuery<{ dispatcherDifferentialSummary: DifferentialRow[] }>(
    QUERIES.dispatcherDifferentialSummary,
    {
      variables: {
        gasStationId,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
      },
      skip: !gasStationId,
    }
  )

  const { data: empData } = useQuery<{ employees: EmployeeRow[] }>(EmployeeQueries.employees, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const employeeById = new Map((empData?.employees ?? []).map((e) => [e.id, e]))
  const rows = data?.dispatcherDifferentialSummary ?? []

  const columns: ColumnDef<DifferentialRow>[] = [
    {
      id: 'bombero',
      header: 'Bombero',
      cell: ({ row }) => {
        const emp = employeeById.get(row.original.dispatcherEmployeeId)
        return emp ? (
          <div>
            <p className="font-medium">{emp.firstName} {emp.lastName}</p>
            <p className="text-xs text-muted-foreground">{emp.position}</p>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{row.original.dispatcherEmployeeId}</span>
        )
      },
    },
    { accessorKey: 'ticketCount', header: 'Tickets' },
    {
      id: 'bruto',
      header: 'Bruto (L / base)',
      cell: ({ row }) => {
        const l = parseFloat(row.original.grossDifferentialLiters)
        const m = parseFloat(row.original.grossDifferentialAmount)
        return (
          <span className={`font-mono text-sm ${toneClass(l)}`}>
            {signed(l, 3)} L · {signed(m, 2)}
          </span>
        )
      },
    },
    {
      id: 'devuelto',
      header: 'Devuelto (L / base)',
      cell: ({ row }) => {
        const l = parseFloat(row.original.refundedLiters)
        const m = parseFloat(row.original.refundedAmount)
        return <span className="font-mono text-sm">{l.toFixed(3)} L · {m.toFixed(2)}</span>
      },
    },
    {
      id: 'neto',
      header: 'Neto (L / base)',
      cell: ({ row }) => {
        const l = parseFloat(row.original.netDifferentialLiters)
        const m = parseFloat(row.original.netDifferentialAmount)
        return (
          <span className={`font-mono font-medium ${toneClass(l)}`}>
            {signed(l, 3)} L · {signed(m, 2)}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-8">
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

      <p className="text-xs text-muted-foreground">
        Diferencial = lo pagado − lo despachado − lo devuelto, por bombero, solo en tickets completados.
        Positivo: sobró dinero a favor de la estación (cobrado de más o despacho menor). Negativo: falta dinero.
        Montos en moneda base. Sin comisiones.
      </p>

      <DataTable columns={columns} data={rows} loading={loading} />
    </div>
  )
}
