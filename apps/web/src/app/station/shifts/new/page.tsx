'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const USERTYPE_TO_ROLE: Record<string, string> = {
  FuelAttendant: 'DISPATCHER',
  Cashier: 'CASHIER',
  Supervisor: 'SUPERVISOR',
  Administrator: 'ADMIN',
  Administrative: 'ACCOUNTANT',
}

const ROLE_LABELS: Record<string, string> = {
  CASHIER: 'Cajero',
  DISPATCHER: 'Bombero',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Gerente',
  ACCOUNTANT: 'Contador',
  ADMIN: 'Administrador',
}

export default function NewShiftPage() {
  const router = useRouter()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const employeeRole = USERTYPE_TO_ROLE[user?.userType ?? ''] ?? 'CASHIER'

  const [create, { loading }] = useMutation(MUTATIONS.createEmployeeShift, {
    refetchQueries: [
      { query: QUERIES.employeeShiftsByGasStation, variables: { gasStationId } },
      { query: QUERIES.activeEmployeeShift, variables: { employeeId: employee?.id } },
    ],
  })

  const handleStart = async () => {
    if (!employee) {
      toast.error('No se encontró tu perfil de empleado.')
      return
    }
    try {
      const result = await create({
        variables: {
          input: {
            employeeId: employee.id,
            gasStationId,
            shiftStartTime: new Date().toISOString(),
            employeeRole,
          },
        },
      })
      toast.success('Turno iniciado.')
      router.push(`/station/shifts/${result.data.createEmployeeShift.id}`)
    } catch (err: any) {
      toast.error(`No se pudo iniciar el turno: ${err.message ?? ''}`)
    }
  }

  return (
    <div className="space-y-6 max-w-sm">
      <PageHeader
        title="Iniciar turno"
        description="Registra el inicio de tu turno de trabajo"
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {!employee && (
        <p className="text-sm text-destructive">
          Tu usuario no tiene un perfil de empleado asignado. Contacta al administrador.
        </p>
      )}

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empleado</span>
              <span className="font-medium">{employee ? `${employee.firstName} ${employee.lastName}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rol en turno</span>
              <span className="font-medium">{ROLE_LABELS[employeeRole] ?? employeeRole}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hora de inicio</span>
              <span className="font-medium">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleStart} disabled={loading || !employee}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Iniciando...' : 'Iniciar turno'}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
