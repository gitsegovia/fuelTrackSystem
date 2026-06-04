'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { useAuth } from '@/hooks/useAuth'
import { QUERIES } from '@/services/graphql/gql/salesTicket'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_DISPATCH: 'Pendiente',
  PAID_PENDING_DISPATCH: 'Pago recibido',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

type Ticket = {
  id: string
  ticketNumber: number
  requestedLiters: string
  totalAmountExpected: string
  status: string
  ticketIssueTime: string
  fuelType: { name: string }
  assignedSaleTypeConfig: { saleTypeName: string; currency: { symbol: string } }
}

export default function TicketsPage() {
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data, loading } = useQuery(QUERIES.salesTicketsByGasStation, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const tickets: Ticket[] = data?.salesTicketsByGasStation ?? []

  const columns: ColumnDef<Ticket>[] = [
    { accessorKey: 'ticketNumber', header: '#' },
    { header: 'Combustible', cell: ({ row }) => row.original.fuelType.name },
    { header: 'Tipo', cell: ({ row }) => row.original.assignedSaleTypeConfig.saleTypeName },
    {
      header: 'Litros',
      cell: ({ row }) => `${parseFloat(row.original.requestedLiters).toLocaleString()} L`,
    },
    {
      header: 'Total',
      cell: ({ row }) =>
        `${row.original.assignedSaleTypeConfig.currency.symbol} ${parseFloat(row.original.totalAmountExpected).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant="outline">{STATUS_LABELS[row.original.status] ?? row.original.status}</Badge>
      ),
    },
    {
      header: 'Hora',
      cell: ({ row }) => format(new Date(row.original.ticketIssueTime), 'HH:mm'),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/station/tickets/${row.original.id}`}>Ver</Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets de venta"
        description="Todas las ventas de la estación"
      />
      <DataTable columns={columns} data={tickets} loading={loading} />
    </div>
  )
}
