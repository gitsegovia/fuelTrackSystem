'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Truck, CreditCard, XCircle } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/salesTicket'
import { MUTATIONS as PaymentMutations, QUERIES as PaymentQueries } from '@/services/graphql/gql/payment'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as DispenserQueries } from '@/services/graphql/gql/dispenser'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_DISPATCH: 'Pendiente de pago y despacho',
  PAID_PENDING_DISPATCH: 'Pagado — pendiente de despacho',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

const dispatchSchema = z.object({
  dispatcherEmployeeId: z.string().min(1, 'Selecciona el bombero'),
  dispenserNozzleId: z.string().min(1, 'Selecciona la boquilla'),
  actualLitersDispatched: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
})

const paymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'MOBILE_PAYMENT', 'BANK_TRANSFER']),
  amount: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
  currencyId: z.string().min(1, 'Selecciona una moneda'),
  transactionReference: z.string().optional(),
})

type DispatchForm = z.infer<typeof dispatchSchema>
type PaymentForm = z.infer<typeof paymentSchema>

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  MOBILE_PAYMENT: 'Pago móvil',
  BANK_TRANSFER: 'Transferencia bancaria',
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''
  const [showDispatch, setShowDispatch] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  const { data, loading } = useQuery(QUERIES.salesTicket, { variables: { id }, skip: !id })
  const { data: paymentsData } = useQuery(PaymentQueries.paymentsBySalesTicket, { variables: { salesTicketId: id }, skip: !id })
  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const { data: currenciesData } = useQuery<{ currencies: any[] }>(CurrencyQueries.currencies)
  const { data: dispensersData } = useQuery(DispenserQueries.dispensersByGasStation, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const [processDispatch, { loading: dispatching }] = useMutation(MUTATIONS.processSalesTicketDispatch, {
    refetchQueries: [{ query: QUERIES.salesTicket, variables: { id } }],
  })
  const [createPayment, { loading: paying }] = useMutation(PaymentMutations.createPayment, {
    refetchQueries: [
      { query: QUERIES.salesTicket, variables: { id } },
      { query: PaymentQueries.paymentsBySalesTicket, variables: { salesTicketId: id } },
    ],
  })
  const [completeTicket, { loading: completing }] = useMutation(MUTATIONS.completeSalesTicketPayment, {
    refetchQueries: [
      { query: QUERIES.salesTicket, variables: { id } },
      { query: QUERIES.salesTicketsByGasStation, variables: { gasStationId } },
    ],
  })
  const [cancelTicket, { loading: canceling }] = useMutation(MUTATIONS.cancelSalesTicket, {
    refetchQueries: [
      { query: QUERIES.salesTicket, variables: { id } },
      { query: QUERIES.salesTicketsByGasStation, variables: { gasStationId } },
    ],
  })

  const dispatchForm = useForm<DispatchForm>({ resolver: zodResolver(dispatchSchema) })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'CASH' },
  })

  const ticket = data?.salesTicket
  const payments: any[] = paymentsData?.paymentsBySalesTicket ?? []
  const stationEmployees = empData?.employees?.filter((e) => e.gasStation?.id === gasStationId) ?? []

  // Boquillas: dispensadores de la estación filtrados por el combustible del ticket
  const allDispensers: any[] = dispensersData?.dispensersByGasStation ?? []
  const relevantDispensers = ticket
    ? allDispensers.filter((d) => d.fuelTypeId === ticket.fuelTypeId && d.isOperational)
    : allDispensers
  const nozzles = relevantDispensers.flatMap((d: any) =>
    (d.nozzles ?? []).filter((n: any) => n.isOperational).map((n: any) => ({
      ...n,
      label: `${d.name} — ${n.name}`,
    }))
  )

  const onDispatch = async (formData: DispatchForm) => {
    try {
      await processDispatch({
        variables: {
          id,
          dispatcherEmployeeId: formData.dispatcherEmployeeId,
          dispenserNozzleId: formData.dispenserNozzleId,
          actualLitersDispatched: parseFloat(formData.actualLitersDispatched),
        },
      })
      toast.success('Despacho registrado.')
      setShowDispatch(false)
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const onPayment = async (formData: PaymentForm) => {
    try {
      await createPayment({
        variables: {
          input: {
            salesTicketId: id,
            paymentMethod: formData.paymentMethod,
            amount: parseFloat(formData.amount),
            currencyId: formData.currencyId,
            paymentTime: new Date().toISOString(),
            transactionReference: formData.transactionReference || null,
          },
        },
      })
      toast.success('Pago registrado.')
      setShowPayment(false)
      paymentForm.reset()
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const onComplete = async () => {
    try {
      await completeTicket({ variables: { id } })
      toast.success('Ticket completado.')
      router.push(`/station/shifts/${ticket?.cashierShiftId}`)
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const onCancel = async () => {
    try {
      await cancelTicket({ variables: { id } })
      toast.success('Ticket cancelado.')
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!ticket) return <p className="text-sm text-muted-foreground">Ticket no encontrado.</p>

  const isActive = ticket.status !== 'COMPLETED' && ticket.status !== 'CANCELED'
  const currency = ticket.assignedSaleTypeConfig?.currency

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title={`Ticket #${ticket.ticketNumber}`}
        description={`${ticket.fuelType.name} · ${format(new Date(ticket.ticketIssueTime), 'dd/MM/yyyy HH:mm')}`}
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {/* Resumen */}
      <Card>
        <CardContent className="pt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="outline">{STATUS_LABELS[ticket.status] ?? ticket.status}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo de venta</span>
            <span>{ticket.assignedSaleTypeConfig?.saleTypeName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Litros solicitados</span>
            <span>{parseFloat(ticket.requestedLiters).toLocaleString()} L</span>
          </div>
          {ticket.actualLitersDispatched && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Litros despachados</span>
              <span>{parseFloat(ticket.actualLitersDispatched).toLocaleString()} L</span>
            </div>
          )}
          <div className="flex justify-between font-medium border-t pt-2">
            <span>Total esperado</span>
            <span>{currency?.symbol} {parseFloat(ticket.totalAmountExpected).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pagos recibidos */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Pagos registrados</h3>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between rounded-lg border px-4 py-2 text-sm">
              <span>{PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</span>
              <span className="font-medium">{p.currency.symbol} {parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      {isActive && (
        <div className="space-y-3">
          {/* Despacho */}
          {!ticket.actualLitersDispatched && (
            <>
              <Button variant="outline" className="w-full" onClick={() => setShowDispatch(!showDispatch)}>
                <Truck className="size-4" /> Registrar despacho
              </Button>
              {showDispatch && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Datos del despacho</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={dispatchForm.handleSubmit(onDispatch)} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Bombero *</Label>
                        <select {...dispatchForm.register('dispatcherEmployeeId')} className={selectClass}>
                          <option value="">Seleccionar...</option>
                          {stationEmployees.map((e) => (
                            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Boquilla *</Label>
                        <select {...dispatchForm.register('dispenserNozzleId')} className={selectClass}>
                          <option value="">Seleccionar...</option>
                          {nozzles.map((n) => (
                            <option key={n.id} value={n.id}>{n.label}</option>
                          ))}
                        </select>
                        {nozzles.length === 0 && (
                          <p className="text-xs text-amber-600">No hay boquillas operativas para este combustible.</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Litros reales despachados *</Label>
                        <Input type="number" step="0.01" placeholder="0.00" {...dispatchForm.register('actualLitersDispatched')} />
                      </div>
                      <Button type="submit" size="sm" disabled={dispatching}>
                        {dispatching && <Loader2 className="size-4 animate-spin" />}
                        Confirmar despacho
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Pago */}
          <Button variant="outline" className="w-full" onClick={() => setShowPayment(!showPayment)}>
            <CreditCard className="size-4" /> Registrar pago
          </Button>
          {showPayment && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Registrar pago</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={paymentForm.handleSubmit(onPayment)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Método *</Label>
                      <select {...paymentForm.register('paymentMethod')} className={selectClass}>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Moneda *</Label>
                      <select {...paymentForm.register('currencyId')} className={selectClass}>
                        <option value="">Seleccionar...</option>
                        {currenciesData?.currencies.map((c) => (
                          <option key={c.id} value={c.id}>{c.symbol}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monto *</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...paymentForm.register('amount')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Referencia (opcional)</Label>
                    <Input placeholder="Nro. de transacción" {...paymentForm.register('transactionReference')} />
                  </div>
                  <Button type="submit" size="sm" disabled={paying}>
                    {paying && <Loader2 className="size-4 animate-spin" />}
                    Confirmar pago
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Completar / Cancelar */}
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={onComplete} disabled={completing}>
              {completing && <Loader2 className="size-4 animate-spin" />}
              Completar ticket
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={canceling}>
              <XCircle className="size-4" /> Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
