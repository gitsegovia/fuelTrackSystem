import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, StopCircle, Clock, Gauge, BarChart2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as TicketQueries } from '@/services/graphql/gql/salesTicket'
import { QUERIES as ReadingQueries } from '@/services/graphql/gql/dispenserReading'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_DISPATCH: 'Pendiente',
  PAID_PENDING_DISPATCH: 'Pago recibido',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  PENDING_PAYMENT_DISPATCH: 'secondary',
  PAID_PENDING_DISPATCH: 'default',
  COMPLETED: 'outline',
  CANCELED: 'destructive',
}

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e: any) => e.user.id === user?.id)

  const { data, loading } = useQuery<{ employeeShift: any }>(QUERIES.employeeShift, { variables: { id }, skip: !id })
  const { data: ticketsData } = useQuery<{ salesTicketsByCashierShift: any[] }>(TicketQueries.salesTicketsByCashierShift, {
    variables: { cashierShiftId: id },
    skip: !id,
  })
  const { data: readingsData } = useQuery<{ dispenserReadingsByShift: any[] }>(ReadingQueries.dispenserReadingsByShift, {
    variables: { employeeShiftId: id },
    skip: !id,
  })

  const [endShift, { loading: ending }] = useMutation(MUTATIONS.endEmployeeShift, {
    refetchQueries: [
      { query: QUERIES.employeeShift, variables: { id } },
      { query: QUERIES.activeEmployeeShift, variables: { employeeId: employee?.id } },
      { query: QUERIES.employeeShiftsByGasStation, variables: { gasStationId } },
    ],
  })

  const shift = data?.employeeShift
  const tickets: any[] = ticketsData?.salesTicketsByCashierShift ?? []
  const readings: any[] = readingsData?.dispenserReadingsByShift ?? []

  const initialReadings = readings.filter((r) => r.readingType === 'INITIAL')
  const finalReadings = readings.filter((r) => r.readingType === 'FINAL')
  const hasInitial = initialReadings.length > 0
  const hasFinal = finalReadings.length > 0

  const nozzleIds = [...new Set(readings.map((r) => r.dispenserNozzleId))]
  const readingsByNozzle = nozzleIds.map((nid) => {
    const initial = initialReadings.find((r) => r.dispenserNozzleId === nid)
    const final = finalReadings.find((r) => r.dispenserNozzleId === nid)
    const nozzle = (initial ?? final)?.dispenserNozzle
    const diff =
      initial && final
        ? parseFloat(final.meterReading) - parseFloat(initial.meterReading)
        : null
    return { nozzleId: nid, nozzle, initial, final, diff }
  })

  const handleEndShift = async () => {
    try {
      await endShift({ variables: { id, shiftEndTime: new Date().toISOString() } })
      toast.success('Turno finalizado.')
      navigate('/shifts')
    } catch (err: any) {
      toast.error(`Error al cerrar turno: ${err.message ?? ''}`)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const isActive = !shift?.shiftEndTime
  const isMyShift = employee && shift?.employee?.id === employee.id

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={`Turno — ${shift?.employee?.firstName} ${shift?.employee?.lastName}`}
        description={shift ? `${shift.employeeRole} · ${format(new Date(shift.shiftStartTime), 'dd/MM/yyyy HH:mm')}` : ''}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Volver
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/shifts/${id}/report`)}>
              <BarChart2 className="size-4" /> Reporte
            </Button>
            {isActive && isMyShift && (
              <Button variant="destructive" size="sm" onClick={handleEndShift} disabled={ending}>
                {ending ? <Clock className="size-4 animate-spin" /> : <StopCircle className="size-4" />}
                Cerrar turno
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Estado</p>
            <Badge variant={isActive ? 'default' : 'outline'} className="mt-1">
              {isActive ? 'Activo' : 'Cerrado'}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Hora de inicio</p>
            <p className="font-medium mt-1">{shift && format(new Date(shift.shiftStartTime), 'HH:mm')}</p>
          </div>
          {shift?.shiftEndTime && (
            <div>
              <p className="text-muted-foreground text-xs">Hora de cierre</p>
              <p className="font-medium mt-1">{format(new Date(shift.shiftEndTime), 'HH:mm')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lecturas de surtidores */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Lecturas de surtidores</h3>
          <div className="flex gap-2">
            {isActive && !hasInitial && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/shifts/${id}/readings/new?type=INITIAL`)}>
                <Gauge className="size-4" /> Lecturas iniciales
              </Button>
            )}
            {isActive && hasInitial && !hasFinal && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/shifts/${id}/readings/new?type=FINAL`)}>
                <Gauge className="size-4" /> Lecturas finales
              </Button>
            )}
            {isActive && hasInitial && hasFinal && (
              <span className="text-xs text-green-600 font-medium self-center">✓ Completas</span>
            )}
          </div>
        </div>

        {readings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay lecturas registradas en este turno.</p>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
                  <span className="col-span-2">Boquilla</span>
                  <span className="text-right">Inicial</span>
                  <span className="text-right">Final</span>
                </div>
                {readingsByNozzle.map(({ nozzleId, nozzle, initial, final, diff }) => (
                  <div key={nozzleId} className="grid grid-cols-4 gap-2 items-center">
                    <span className="col-span-2 truncate">{nozzle?.name ?? nozzleId}</span>
                    <span className="text-right font-mono text-xs">
                      {initial ? parseFloat(initial.meterReading).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                    </span>
                    <span className="text-right font-mono text-xs">
                      {final ? parseFloat(final.meterReading).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                    </span>
                    {diff !== null && (
                      <span className="col-span-4 text-xs text-amber-600 text-right -mt-1">
                        +{diff.toLocaleString(undefined, { minimumFractionDigits: 2 })} L despachados
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tickets del turno */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Tickets de venta ({tickets.length})</h3>
          {isActive && (
            <Button size="sm" onClick={() => navigate(`/tickets/new?shiftId=${id}`)}>
              <Plus className="size-4" /> Nuevo ticket
            </Button>
          )}
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tickets en este turno.</p>
        ) : (
          tickets.map((t: any) => (
            <Link key={t.id} to={`/tickets/${t.id}`}>
              <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">#{t.ticketNumber} — {t.fuelType.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parseFloat(t.requestedLiters).toLocaleString()} L ·{' '}
                    {t.assignedSaleTypeConfig.currency.symbol} {parseFloat(t.totalAmountExpected).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
