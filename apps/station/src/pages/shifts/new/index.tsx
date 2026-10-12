import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, WifiOff } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as TicketQueries } from '@/services/graphql/gql/salesTicket'
import { QUERIES as ReadingQueries } from '@/services/graphql/gql/dispenserReading'
import { ensureEmptyList, upsertInCachedList } from '@/lib/offline-cache'
import { useCan } from '@/hooks/useCan'
import { useLicense } from '@/context/LicenseContext'
import { LICENSE_READ_ONLY_BANNER } from '@/components/layout/LicenseBanner'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { useOffline } from '@/context/OfflineContext'
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const canDo = useCan()
  const { readOnly: licenseReadOnly } = useLicense()
  const { isOnline } = useOffline()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees, {
    variables: { gasStationId },
    skip: !gasStationId,
  })
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const employeeRole = USERTYPE_TO_ROLE[user?.userType ?? ''] ?? 'CASHIER'

  const [create, { loading }] = useOfflineMutation<{ createEmployeeShift: { id: string } }>(
    MUTATIONS.createEmployeeShift,
    {
      refetchQueries: [
        { query: QUERIES.employeeShiftsByGasStation, variables: { gasStationId } },
        { query: QUERIES.activeEmployeeShift, variables: { employeeId: employee?.id } },
      ],
      // Offline: el turno queda como activo con su localId para que las operaciones
      // siguientes (ej. medición de tanque) lo referencien y se sincronicen detrás de él.
      // El detalle (/shifts/:localId) lo resuelve el cache redirect de employeeShift(id).
      writeToCache: (cache, { variables, localId }) => {
        if (!localId || !employee) return
        const input = variables?.input ?? {}
        const shift = {
          __typename: 'EmployeeShift',
          id: localId,
          employeeId: employee.id,
          gasStationId,
          employeeRole: input.employeeRole,
          shiftStartTime: input.shiftStartTime,
          shiftEndTime: null,
          createdAt: input.shiftStartTime,
          employee: {
            __typename: 'Employee',
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
          },
          gasStation: {
            __typename: 'GasStation',
            id: gasStationId,
            name: user?.assignedGasStation?.name ?? '',
          },
        }
        try {
          cache.writeQuery({
            query: QUERIES.activeEmployeeShift,
            variables: { employeeId: employee.id },
            data: { activeEmployeeShift: shift },
          })
          upsertInCachedList(cache, {
            query: QUERIES.employeeShiftsByGasStation,
            variables: { gasStationId },
            field: 'employeeShiftsByGasStation',
            item: shift,
          })
          // En el servidor todavía no existe: sus tickets y lecturas empiezan vacíos.
          ensureEmptyList(cache, TicketQueries.salesTicketsByCashierShift, { cashierShiftId: localId }, 'salesTicketsByCashierShift')
          ensureEmptyList(cache, ReadingQueries.dispenserReadingsByShift, { employeeShiftId: localId }, 'dispenserReadingsByShift')
        } catch (e) {
          console.warn('[FuelTrack] writeToCache shift failed:', e)
        }
      },
    }
  )

  const handleStart = async () => {
    if (!employee) {
      toast.error('No se encontró tu perfil de empleado.')
      return
    }
    try {
      const localId = crypto.randomUUID()
      const { data: result, wasQueued } = await create({
        variables: {
          input: {
            employeeId: employee.id,
            gasStationId,
            shiftStartTime: new Date().toISOString(),
            employeeRole,
          },
        },
        localId,
        optimisticResponse: { createEmployeeShift: { id: localId } },
      })

      if (wasQueued) {
        toast.success('Turno guardado. Se enviará al servidor cuando vuelva la conexión.')
        navigate(`/shifts/${localId}`)
      } else {
        toast.success('Turno iniciado.')
        navigate(`/shifts/${result!.createEmployeeShift.id}`)
      }
    } catch (err: any) {
      toast.error(`No se pudo iniciar el turno: ${err.message ?? ''}`)
    }
  }

  if (!canDo('openOwnShift')) {
    return (
      <div className="space-y-6 max-w-sm">
        <PageHeader
          title="Iniciar turno"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Volver
            </Button>
          }
        />
        <p className="text-sm rounded-lg border px-3 py-2">
          {licenseReadOnly ? LICENSE_READ_ONLY_BANNER : 'Tu cargo no puede iniciar turnos.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-sm">
      <PageHeader
        title="Iniciar turno"
        description="Registra el inicio de tu turno de trabajo"
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {!employee && (
        <p className="text-sm text-destructive">
          Tu usuario no tiene un perfil de empleado asignado. Contacta al administrador.
        </p>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff className="size-4 shrink-0" />
          <span>Sin conexión — el turno se guardará localmente y se sincronizará al reconectar.</span>
        </div>
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
              {loading ? 'Guardando...' : !isOnline ? 'Guardar offline' : 'Iniciar turno'}
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
