'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Plus, StopCircle, Clock } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as TicketQueries } from '@/services/graphql/gql/salesTicket'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const router = useRouter()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const { data, loading } = useQuery(QUERIES.employeeShift, { variables: { id }, skip: !id })
  const { data: ticketsData } = useQuery(TicketQueries.salesTicketsByCashierShift, {
    variables: { cashierShiftId: id },
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

  const handleEndShift = async () => {
    try {
      await endShift({ variables: { id, shiftEndTime: new Date().toISOString() } })
      toast.success('Turno finalizado.')
      router.push('/station/shifts')
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
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="size-4" /> Volver
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

      {/* Estado */}
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

      {/* Tickets del turno */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Tickets de venta ({tickets.length})</h3>
          {isActive && (
            <Button size="sm" asChild>
              <Link href={`/station/tickets/new?shiftId=${id}`}>
                <Plus className="size-4" /> Nuevo ticket
              </Link>
            </Button>
          )}
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tickets en este turno.</p>
        ) : (
          tickets.map((t) => (
            <Link key={t.id} href={`/station/tickets/${t.id}`}>
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
