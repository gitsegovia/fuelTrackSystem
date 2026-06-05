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

interface TankBalanceRow {
  tank: { id: string; name: string; maxCapacityLiters: string; fuelType: { name: string } }
  periodStart: string
  periodEnd: string
  openingVolumeLiters: string
  totalReceivedLiters: string
  totalDispatchedLiters: string
  expectedClosingVolume: string
  actualClosingVolume: string
  varianceLiters: string
  variancePercent: string
}

const columns: ColumnDef<TankBalanceRow>[] = [
  {
    id: 'tanque',
    header: 'Tanque',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.tank.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.tank.fuelType.name}</p>
      </div>
    ),
  },
  {
    accessorKey: 'openingVolumeLiters',
    header: 'Apertura (L)',
    cell: ({ getValue }) => parseFloat(getValue() as string).toFixed(0),
  },
  {
    accessorKey: 'totalReceivedLiters',
    header: '+ Recibido (L)',
    cell: ({ getValue }) => (
      <span className="text-emerald-600 font-mono">+{parseFloat(getValue() as string).toFixed(0)}</span>
    ),
  },
  {
    accessorKey: 'totalDispatchedLiters',
    header: '− Despachado (L)',
    cell: ({ getValue }) => (
      <span className="text-muted-foreground font-mono">−{parseFloat(getValue() as string).toFixed(0)}</span>
    ),
  },
  {
    accessorKey: 'expectedClosingVolume',
    header: 'Esperado (L)',
    cell: ({ getValue }) => <span className="font-mono">{parseFloat(getValue() as string).toFixed(0)}</span>,
  },
  {
    accessorKey: 'actualClosingVolume',
    header: 'Real (L)',
    cell: ({ getValue }) => <span className="font-mono font-medium">{parseFloat(getValue() as string).toFixed(0)}</span>,
  },
  {
    id: 'varianza',
    header: 'Varianza',
    cell: ({ row }) => {
      const v = parseFloat(row.original.varianceLiters)
      const pct = parseFloat(row.original.variancePercent)
      const color = Math.abs(v) < 1 ? '' : v < 0 ? 'text-destructive' : 'text-emerald-600'
      return (
        <div className={`font-mono font-medium ${color}`}>
          <p>{v > 0 ? '+' : ''}{v.toFixed(2)} L</p>
          <p className="text-xs opacity-75">{pct > 0 ? '+' : ''}{pct.toFixed(3)}%</p>
        </div>
      )
    },
  },
  {
    id: 'estado',
    header: 'Estado',
    cell: ({ row }) => {
      const pct = Math.abs(parseFloat(row.original.variancePercent))
      if (pct > 2) return <Badge variant="destructive">Crítico (&gt;2%)</Badge>
      if (pct > 0.5) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Atención</Badge>
      return <Badge variant="outline" className="text-emerald-700 border-emerald-200">Normal</Badge>
    },
  },
]

function todayISO() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

export default function TanquesAuditPage() {
  const searchParams = useSearchParams()
  const gasStationId = searchParams.get('stationId') ?? ''

  const [startDate, setStartDate] = useState(thirtyDaysAgoISO())
  const [endDate, setEndDate] = useState(todayISO())

  const start = startDate ? new Date(startDate).toISOString() : new Date(thirtyDaysAgoISO()).toISOString()
  const end = endDate ? new Date(endDate + 'T23:59:59').toISOString() : new Date().toISOString()

  const { data, loading } = useQuery<{ tankBalanceAuditByStation: TankBalanceRow[] }>(
    QUERIES.tankBalanceAuditByStation,
    {
      variables: { gasStationId, startDate: start, endDate: end },
      skip: !gasStationId,
    }
  )

  const rows = data?.tankBalanceAuditByStation ?? []

  const totalVariance = rows.reduce((s, r) => s + parseFloat(r.varianceLiters), 0)
  const criticalTanks = rows.filter((r) => Math.abs(parseFloat(r.variancePercent)) > 2).length

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
          <p className="text-xs text-muted-foreground">Tanques analizados</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Varianza total acumulada</p>
          <p className={`text-2xl font-bold font-mono ${totalVariance < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {totalVariance > 0 ? '+' : ''}{totalVariance.toFixed(2)} L
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Tanques críticos (&gt;2% varianza)</p>
          <p className={`text-2xl font-bold ${criticalTanks > 0 ? 'text-destructive' : ''}`}>{criticalTanks}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        La <strong>varianza</strong> es la diferencia entre el volumen esperado (apertura + recepciones − despachos) y el volumen medido físicamente.
        Una varianza negativa indica merma (evaporación, fuga o error de medición). El umbral de alerta es ±0.5%.
      </p>

      <DataTable columns={columns} data={rows} loading={loading} />
    </div>
  )
}
