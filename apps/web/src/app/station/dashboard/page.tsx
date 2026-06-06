'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { Clock, Receipt, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { QUERIES as ShiftQueries } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as TicketQueries } from '@/services/graphql/gql/salesTicket'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_DISPATCH: 'Pendiente',
  PAID_PENDING_DISPATCH: 'Pagado — pend. despacho',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

export default function StationDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const { data: shiftData } = useQuery<{ activeEmployeeShift: any }>(ShiftQueries.activeEmployeeShift, {
    variables: { employeeId: employee?.id },
    skip: !employee?.id,
  })
  const activeShift = shiftData?.activeEmployeeShift

  const { data: ticketsData } = useQuery<{ salesTicketsByGasStation: any[] }>(TicketQueries.salesTicketsByGasStation, {
    variables: { gasStationId },
    skip: !gasStationId,
  })
  const tickets: any[] = ticketsData?.salesTicketsByGasStation ?? []
  const openTickets = tickets.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELED')

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${employee?.firstName ?? user?.username}`}
        description={format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
      />

      {/* Turno activo */}
      {activeShift ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Turno activo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Iniciado: <span className="font-medium">{format(new Date(activeShift.shiftStartTime), 'HH:mm')}</span>
            </p>
            <p className="text-sm">
              Rol: <span className="font-medium">{activeShift.employeeRole}</span>
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => router.push(`/station/shifts/${activeShift.id}`)}>
                Ver turno
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/station/tickets/new?shiftId=${activeShift.id}`)}>
                <Plus className="size-4" /> Nuevo ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Sin turno activo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inicia un turno para comenzar a operar</p>
            </div>
            <Button size="sm" onClick={() => router.push('/station/shifts/new')}>
              <Clock className="size-4" /> Iniciar turno
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="size-4" /> Tickets abiertos hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{openTickets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Completados hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tickets.filter((t) => t.status === 'COMPLETED').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets recientes */}
      {openTickets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tickets pendientes</h3>
          {openTickets.slice(0, 5).map((t) => (
            <Link key={t.id} href={`/station/tickets/${t.id}`}>
              <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">#{t.ticketNumber} — {t.fuelType.name}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(t.requestedLiters).toLocaleString()} L</p>
                </div>
                <span className="text-xs text-muted-foreground">{STATUS_LABELS[t.status] ?? t.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
