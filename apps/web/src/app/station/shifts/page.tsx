'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { QUERIES } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

type Shift = {
  id: string
  employeeRole: string
  shiftStartTime: string
  shiftEndTime: string | null
  employee: { id: string; firstName: string; lastName: string }
}

export default function ShiftsPage() {
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const { data, loading } = useQuery(QUERIES.employeeShiftsByGasStation, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const shifts: Shift[] = data?.employeeShiftsByGasStation ?? []

  const columns: ColumnDef<Shift>[] = [
    {
      header: 'Empleado',
      cell: ({ row }) => `${row.original.employee.firstName} ${row.original.employee.lastName}`,
    },
    { accessorKey: 'employeeRole', header: 'Rol' },
    {
      header: 'Inicio',
      cell: ({ row }) => format(new Date(row.original.shiftStartTime), 'dd/MM/yyyy HH:mm'),
    },
    {
      header: 'Fin',
      cell: ({ row }) =>
        row.original.shiftEndTime
          ? format(new Date(row.original.shiftEndTime), 'dd/MM/yyyy HH:mm')
          : <Badge variant="outline" className="text-primary border-primary/40">Activo</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/station/shifts/${row.original.id}`}>Ver</Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turnos"
        description="Historial de turnos de la estación"
        action={
          !employee ? undefined : (
            <Button size="sm" asChild>
              <Link href="/station/shifts/new">
                <Plus className="size-4" /> Iniciar turno
              </Link>
            </Button>
          )
        }
      />
      <DataTable columns={columns} data={shifts} loading={loading} />
    </div>
  )
}
