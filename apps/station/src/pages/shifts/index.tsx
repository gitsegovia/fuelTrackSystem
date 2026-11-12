import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCan } from '@/hooks/useCan'
import { QUERIES } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const canDo = useCan()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees, {
    variables: { gasStationId },
    skip: !gasStationId,
  })
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const { data, loading } = useQuery<{ employeeShiftsByGasStation: Shift[] }>(QUERIES.employeeShiftsByGasStation, {
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
          : <StatusBadge tone="info">Activo</StatusBadge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shifts/${row.original.id}`)}>Ver</Button>
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
          !employee || !canDo('openOwnShift') ? undefined : (
            <Button size="sm" onClick={() => navigate('/shifts/new')}>
              <Plus className="size-4" /> Iniciar turno
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={shifts}
        loading={loading}
        mobileCard={(s) => (
          <button
            type="button"
            onClick={() => navigate(`/shifts/${s.id}`)}
            className="w-full rounded-lg border bg-card p-3 text-left active:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.employee.firstName} {s.employee.lastName}</p>
                <p className="text-xs text-muted-foreground">{s.employeeRole}</p>
              </div>
              {s.shiftEndTime ? null : (
                <StatusBadge tone="info" className="shrink-0">Activo</StatusBadge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {format(new Date(s.shiftStartTime), 'dd/MM/yyyy HH:mm')}
              {s.shiftEndTime ? ` → ${format(new Date(s.shiftEndTime), 'dd/MM/yyyy HH:mm')}` : ''}
            </p>
          </button>
        )}
      />
    </div>
  )
}
