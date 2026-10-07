import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Truck, CreditCard, XCircle, Plus, Trash2, WifiOff, Undo2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/salesTicket'
import { MUTATIONS as PaymentMutations, QUERIES as PaymentQueries } from '@/services/graphql/gql/payment'
import { QUERIES as RefundQueries, MUTATIONS as RefundMutations } from '@/services/graphql/gql/ticketRefund'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as DispenserQueries } from '@/services/graphql/gql/dispenser'
import { TICKET_STATUS_LABELS, PAYMENT_MODE_LABELS, canPay, canDispatch, isOpenTicket } from '@/lib/ticket-status'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/permissions'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { upsertInCachedList } from '@/lib/offline-cache'
import { useOffline } from '@/context/OfflineContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  MOBILE_PAYMENT: 'Pago móvil',
  BANK_TRANSFER: 'Transferencia bancaria',
}

const dispatchSchema = z.object({
  dispatcherEmployeeId: z.string().min(1, 'Selecciona el bombero'),
  dispenserNozzleId: z.string().min(1, 'Selecciona la boquilla'),
  actualLitersDispatched: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
})

const paymentLineSchema = z.object({
  paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'MOBILE_PAYMENT', 'BANK_TRANSFER']),
  amount: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
  currencyId: z.string().min(1, 'Selecciona moneda'),
  transactionReference: z.string().optional(),
})

const paymentSchema = z.object({
  lines: z.array(paymentLineSchema).min(1),
})

const refundSchema = z.object({
  amount: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
  paymentMethod: z.enum(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'MOBILE_PAYMENT', 'BANK_TRANSFER']),
  notes: z.string().optional(),
})

type DispatchForm = z.infer<typeof dispatchSchema>
type PaymentForm = z.infer<typeof paymentSchema>
type RefundForm = z.infer<typeof refundSchema>

const EMPTY_LINE = { paymentMethod: 'CASH' as const, amount: '', currencyId: '', transactionReference: '' }

/** Estado al que pasa el ticket cuando se completa el despacho, según el modo (ADR-015). */
function statusAfterDispatch(mode: string): string {
  return mode === 'PREPAID' ? 'COMPLETED' : 'DISPATCHED'
}
/** Estado al que pasa el ticket cuando el pago cubre el total, según el modo (ADR-015). */
function statusAfterFullPayment(mode: string): string {
  return mode === 'PREPAID' ? 'PAID' : 'COMPLETED'
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const gasStationId = user?.assignedGasStation?.id ?? ''
  const [showDispatch, setShowDispatch] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [lockedCount, setLockedCount] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmRefund, setConfirmRefund] = useState<RefundForm | null>(null)

  const { data, loading } = useQuery<{ salesTicket: any }>(QUERIES.salesTicket, {
    variables: { id },
    skip: !id,
    // cache-first en la vista detalle para funcionar offline con el fragmento escrito por tickets/new
    fetchPolicy: 'cache-first',
  })
  const { data: paymentsData } = useQuery<{ paymentsBySalesTicket: any[] }>(
    PaymentQueries.paymentsBySalesTicket,
    { variables: { salesTicketId: id }, skip: !id, fetchPolicy: 'cache-first' }
  )
  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees, {
    variables: { gasStationId },
    skip: !gasStationId,
  })
  const { data: currenciesData } = useQuery<{ currencies: any[] }>(CurrencyQueries.currencies)
  const { data: dispensersData } = useQuery<{ dispensersByGasStation: any[] }>(
    DispenserQueries.dispensersByGasStation,
    { variables: { gasStationId }, skip: !gasStationId }
  )

  const ticket = data?.salesTicket
  const completed = ticket?.status === 'COMPLETED'

  const { data: differentialData } = useQuery<{ salesTicketDifferential: any }>(QUERIES.salesTicketDifferential, {
    variables: { id }, skip: !id || !completed, fetchPolicy: 'cache-and-network',
  })
  const { data: refundsData } = useQuery<{ ticketRefundsBySalesTicket: any[] }>(RefundQueries.ticketRefundsBySalesTicket, {
    variables: { salesTicketId: id }, skip: !id || !completed, fetchPolicy: 'cache-and-network',
  })
  const differential = differentialData?.salesTicketDifferential
  const refunds: any[] = refundsData?.ticketRefundsBySalesTicket ?? []

  // El ticket (id) puede ser un localId si fue creado offline. dependsOn: id captura eso: cuando
  // el sync procese createSalesTicket primero y obtenga el ID real, remapeará id → ID real acá
  // también. Offline, cada operación refleja en el cache el efecto que tendrá en el servidor
  // (optimista; el refetch posterior al sync lo reemplaza). Así la UI no ofrece repetirla.
  const ticketCacheId = { __typename: 'SalesTicket', id }
  const setTicketStatus = (cache: any, status: string) =>
    cache.modify({ id: cache.identify(ticketCacheId), fields: { status: () => status } })

  const [processDispatch, { loading: dispatching }] = useOfflineMutation(
    MUTATIONS.processSalesTicketDispatch,
    {
      refetchQueries: [{ query: QUERIES.salesTicket, variables: { id } }],
      // Como el servidor (ADR-015): guarda el despacho; en postpago recalcula el total con el
      // precio actual y pasa a DISPATCHED; en prepago el total no cambia y pasa a COMPLETED
      // (ya estaba PAID).
      writeToCache: (cache, { variables }) => {
        if (!variables || !ticket) return
        const liters = Number(variables.actualLitersDispatched)
        const mode = ticket.paymentMode
        const price = parseFloat(ticket?.assignedSaleTypeConfig?.salePricePerLiter ?? 'NaN')
        cache.modify({
          id: cache.identify(ticketCacheId),
          fields: {
            actualLitersDispatched: () => String(liters),
            dispatcherEmployeeId: () => variables.dispatcherEmployeeId,
            dispenserNozzleId: () => variables.dispenserNozzleId,
            totalAmountExpected: (prev: string) =>
              mode === 'POSTPAID' && !isNaN(price) ? String(liters * price) : prev,
            status: () => statusAfterDispatch(mode),
          },
        })
      },
    }
  )

  const [createPayments, { loading: paying }] = useOfflineMutation(
    PaymentMutations.createPayments,
    {
      refetchQueries: [
        { query: QUERIES.salesTicket, variables: { id } },
        { query: PaymentQueries.paymentsBySalesTicket, variables: { salesTicketId: id } },
      ],
      // Como el servidor: cada línea toma la tasa actual de su moneda y, si el total pagado en
      // base cubre el total del ticket, pasa al siguiente estado según el modo (ADR-015).
      writeToCache: (cache, { variables }) => {
        if (!variables || !ticket) return
        let paidInBase = alreadyPaidInBase
        for (const line of variables.payments ?? []) {
          const currency = currenciesData?.currencies.find((c: any) => c.id === line.currencyId)
          const rate = currency?.exchangeRate ?? '1'
          paidInBase += Number(line.amount) / parseFloat(rate)
          upsertInCachedList(cache, {
            query: PaymentQueries.paymentsBySalesTicket,
            variables: { salesTicketId: variables.salesTicketId },
            field: 'paymentsBySalesTicket',
            position: 'end',
            createIfMissing: true,
            item: {
              __typename: 'Payment',
              id: crypto.randomUUID(),
              salesTicketId: variables.salesTicketId,
              paymentMethod: line.paymentMethod,
              amount: String(line.amount),
              paymentTime: variables.paymentTime,
              transactionReference: line.transactionReference ?? null,
              currencyId: line.currencyId,
              exchangeRateAtPayment: String(rate),
              createdAt: variables.paymentTime,
              currency: {
                __typename: 'Currency',
                id: line.currencyId,
                name: currency?.name ?? '',
                symbol: currency?.symbol ?? '',
              },
            } as { id: string },
          })
        }
        if (ticket.status !== 'CANCELED' && paidInBase >= totalExpectedInBase) {
          setTicketStatus(cache, statusAfterFullPayment(ticket.paymentMode))
        }
      },
    }
  )

  const [cancelTicket, { loading: canceling }] = useOfflineMutation(
    MUTATIONS.cancelSalesTicket,
    {
      refetchQueries: [
        { query: QUERIES.salesTicket, variables: { id } },
        { query: QUERIES.salesTicketsByGasStation, variables: { gasStationId } },
      ],
      writeToCache: (cache) => setTicketStatus(cache, 'CANCELED'),
    }
  )

  const [createRefund, { loading: refunding }] = useOfflineMutation(
    RefundMutations.createTicketRefund,
    {
      refetchQueries: [
        { query: RefundQueries.ticketRefundsBySalesTicket, variables: { salesTicketId: id } },
        { query: QUERIES.salesTicketDifferential, variables: { id } },
      ],
      // Refleja el efecto que tendrá en el servidor: agrega la devolución a la lista y descuenta
      // el diferencial pendiente (en moneda base, igual que lo calcula el servidor).
      writeToCache: (cache, { variables }) => {
        const input = (variables as any)?.input
        if (!input) return
        const rate = ticketCurrencyRate || 1
        const refundInBase = Number(input.amount) / rate
        upsertInCachedList(cache, {
          query: RefundQueries.ticketRefundsBySalesTicket,
          variables: { salesTicketId: id },
          field: 'ticketRefundsBySalesTicket',
          position: 'end',
          createIfMissing: true,
          item: {
            __typename: 'TicketRefund',
            id: crypto.randomUUID(),
            salesTicketId: id,
            amount: String(input.amount),
            currencyId: input.currencyId,
            exchangeRateAtRefund: String(rate),
            paymentMethod: input.paymentMethod,
            refundedAt: input.refundedAt,
            notes: input.notes ?? null,
            currency: {
              __typename: 'Currency',
              id: ticketCurrency?.id,
              name: ticketCurrency?.name ?? '',
              symbol: ticketCurrency?.symbol ?? '',
            },
          } as { id: string },
        })
        if (differential) {
          const price = parseFloat(ticket?.pricePerLiter ?? 'NaN')
          const newRefunded = parseFloat(differential.refundedAmount) + refundInBase
          const newDifferential = Math.max(0, parseFloat(differential.differentialAmount) - refundInBase)
          const newLiters = !isNaN(price) && price > 0 ? (newDifferential * rate) / price : 0
          cache.writeQuery({
            query: QUERIES.salesTicketDifferential,
            variables: { id },
            data: {
              salesTicketDifferential: {
                __typename: 'SalesTicketDifferential',
                paidAmount: differential.paidAmount,
                dispatchedAmount: differential.dispatchedAmount,
                refundedAmount: String(newRefunded),
                differentialAmount: String(newDifferential),
                differentialLiters: String(newLiters),
              },
            },
          })
        }
      },
    }
  )

  const dispatchForm = useForm<DispatchForm>({ resolver: zodResolver(dispatchSchema) })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { lines: [EMPTY_LINE] },
  })
  const refundForm = useForm<RefundForm>({ resolver: zodResolver(refundSchema) })
  const { fields, append, remove } = useFieldArray({ control: paymentForm.control, name: 'lines' })
  const watchedLines = paymentForm.watch('lines')

  const payments: any[] = paymentsData?.paymentsBySalesTicket ?? []
  const stationEmployees = empData?.employees ?? []

  const allDispensers: any[] = dispensersData?.dispensersByGasStation ?? []
  const relevantDispensers = ticket
    ? allDispensers.filter((d: any) => d.fuelTypeId === ticket.fuelTypeId && d.isOperational)
    : allDispensers
  const nozzles = relevantDispensers.flatMap((d: any) =>
    (d.nozzles ?? []).filter((n: any) => n.isOperational).map((n: any) => ({
      ...n,
      label: `${d.name} — ${n.name}`,
    }))
  )

  const ticketCurrency = ticket?.assignedSaleTypeConfig?.currency
  const ticketCurrencyRate = parseFloat(ticketCurrency?.exchangeRate ?? '1')
  const totalExpected = ticket ? parseFloat(ticket.totalAmountExpected) : 0
  const totalExpectedInBase = totalExpected / ticketCurrencyRate

  const alreadyPaidInBase = payments.reduce((sum: number, p: any) => {
    const rate = parseFloat(p.exchangeRateAtPayment)
    return sum + (rate > 0 ? parseFloat(p.amount) / rate : 0)
  }, 0)
  const remainingInBase = Math.max(0, totalExpectedInBase - alreadyPaidInBase)

  const lockedLinesInBase = watchedLines.slice(0, lockedCount).reduce((sum, line) => {
    const currency = currenciesData?.currencies.find((c: any) => c.id === line.currencyId)
    const amount = parseFloat(line.amount)
    if (!currency || isNaN(amount) || amount <= 0) return sum
    return sum + amount / parseFloat(currency.exchangeRate)
  }, 0)
  const pendingForActiveLine = Math.max(0, remainingInBase - lockedLinesInBase)

  const totalEnteredInBase = watchedLines.reduce((sum, line) => {
    const currency = currenciesData?.currencies.find((c: any) => c.id === line.currencyId)
    const amount = parseFloat(line.amount)
    if (!currency || isNaN(amount) || amount <= 0) return sum
    return sum + amount / parseFloat(currency.exchangeRate)
  }, 0)
  // Mismo criterio que pendingForActiveLine: descuenta lo ya pagado en rondas previas
  // (remainingInBase), no el total del ticket completo.
  const formRemainingInBase = Math.max(0, remainingInBase - totalEnteredInBase)
  const formIsCovered = totalEnteredInBase > 0 && totalEnteredInBase >= remainingInBase

  const pendingRefundInBase = differential ? parseFloat(differential.differentialAmount) : 0

  const onDispatch = async (formData: DispatchForm) => {
    if (!ticket) return
    // Prepago: lo pagado ya fijó el total, así que no se puede despachar más de lo pedido.
    if (ticket.paymentMode === 'PREPAID') {
      const liters = parseFloat(formData.actualLitersDispatched)
      const maxLiters = parseFloat(ticket.requestedLiters)
      if (liters > maxLiters) {
        toast.error(`No se puede despachar más de lo pagado: máximo ${maxLiters} L.`)
        return
      }
    }
    try {
      const { wasQueued } = await processDispatch({
        variables: {
          id,
          dispatcherEmployeeId: formData.dispatcherEmployeeId,
          dispenserNozzleId: formData.dispenserNozzleId,
          actualLitersDispatched: parseFloat(formData.actualLitersDispatched),
        },
        // Si el ticket fue creado offline, id ES su localId.
        // El sync remapea id → ID real antes de enviar esta mutation.
        dependsOn: id,
        optimisticResponse: { processSalesTicketDispatch: { id } },
      })
      toast.success(wasQueued ? 'Despacho guardado offline.' : 'Despacho registrado.')
      setShowDispatch(false)
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const onPayment = async (formData: PaymentForm) => {
    try {
      const { wasQueued } = await createPayments({
        variables: {
          salesTicketId: id,
          paymentTime: new Date().toISOString(),
          payments: formData.lines.map((l) => ({
            paymentMethod: l.paymentMethod,
            amount: parseFloat(l.amount),
            currencyId: l.currencyId,
            transactionReference: l.transactionReference || null,
          })),
        },
        dependsOn: id,
        optimisticResponse: { createPayments: [] },
      })
      toast.success(wasQueued ? 'Pago(s) guardado(s) offline.' : 'Pago(s) registrado(s).')
      setShowPayment(false)
      setLockedCount(0)
      paymentForm.reset({ lines: [EMPTY_LINE] })
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const handleRemove = (index: number) => {
    if (index < lockedCount) setLockedCount((n) => n - 1)
    remove(index)
  }

  const handleAppend = () => {
    const lastLine = watchedLines[fields.length - 1]
    const amount = parseFloat(lastLine?.amount ?? '0')
    if (!lastLine?.currencyId || isNaN(amount) || amount <= 0) {
      toast.error('Completa el monto y la moneda del pago actual antes de agregar otro.')
      return
    }
    setLockedCount((n) => n + 1)
    append(EMPTY_LINE)
  }

  const onCancel = async () => {
    try {
      const { wasQueued } = await cancelTicket({
        variables: { id },
        dependsOn: id,
        optimisticResponse: { cancelSalesTicket: { id } },
      })
      toast.success(wasQueued ? 'Cancelación guardada offline.' : 'Ticket cancelado.')
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
  }

  const onRefundSubmit = (formData: RefundForm) => setConfirmRefund(formData)

  const doRefund = async (formData: RefundForm) => {
    try {
      const { wasQueued } = await createRefund({
        variables: {
          input: {
            salesTicketId: id,
            amount: parseFloat(formData.amount),
            currencyId: ticketCurrency?.id,
            paymentMethod: formData.paymentMethod,
            refundedAt: new Date().toISOString(),
            recordedById: user?.id,
            notes: formData.notes || null,
          },
        },
        dependsOn: id,
        optimisticResponse: { createTicketRefund: { id: crypto.randomUUID() } },
      })
      toast.success(wasQueued ? 'Devolución guardada offline.' : 'Devolución registrada.')
      setShowRefund(false)
      refundForm.reset({ amount: '', paymentMethod: 'CASH', notes: '' })
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    } finally {
      setConfirmRefund(null)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  // Ticket no existe ni en servidor ni en cache (no fue creado offline con writeToCache)
  if (!ticket) {
    return (
      <div className="space-y-4 max-w-lg">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Volver
        </Button>
        <p className="text-sm text-muted-foreground">
          {!isOnline
            ? 'Sin conexión y el ticket no está en el cache local.'
            : 'Ticket no encontrado.'}
        </p>
      </div>
    )
  }

  const open = isOpenTicket(ticket.status)
  const showDispatchAction = open && can(user, 'dispatchTicket') && canDispatch(ticket.paymentMode, ticket.status)
  const showPaymentAction = open && can(user, 'payTicket') && canPay(ticket.paymentMode, ticket.status)

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title={`Ticket #${ticket.ticketNumber || '—'}`}
        description={`${ticket.fuelType.name} · ${format(new Date(ticket.ticketIssueTime), 'dd/MM/yyyy HH:mm')}`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff className="size-4 shrink-0" />
          <span>Sin conexión — las operaciones se guardarán y sincronizarán al reconectar.</span>
        </div>
      )}

      {/* Resumen */}
      <Card>
        <CardContent className="pt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Modo</span>
            <span>{PAYMENT_MODE_LABELS[ticket.paymentMode] ?? ticket.paymentMode}</span>
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
            <span>Total a cobrar</span>
            <span>
              {ticketCurrency?.symbol}{' '}
              {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de pagos */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Pagos registrados</h3>
          {payments.map((p: any) => (
            <div key={p.id} className="rounded-lg border px-4 py-2 text-sm space-y-0.5">
              <div className="flex justify-between">
                <span>{PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</span>
                <span className="font-medium">
                  {p.currency.symbol}{' '}
                  {parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tasa al pagar</span>
                <span>1 base = {parseFloat(p.exchangeRateAtPayment).toLocaleString(undefined, { maximumFractionDigits: 4 })} {p.currency.symbol}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones (despacho / pago, según modo y estado) */}
      {open && (showDispatchAction || showPaymentAction) && (
        <div className="space-y-3">
          {showDispatchAction && (
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
                          {stationEmployees.map((e: any) => (
                            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Boquilla *</Label>
                        <select {...dispatchForm.register('dispenserNozzleId')} className={selectClass}>
                          <option value="">Seleccionar...</option>
                          {nozzles.map((n: any) => (
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
                        {ticket.paymentMode === 'PREPAID' && (
                          <p className="text-xs text-muted-foreground">
                            Máximo {parseFloat(ticket.requestedLiters).toLocaleString()} L (ya pagado).
                          </p>
                        )}
                      </div>
                      <Button type="submit" size="sm" disabled={dispatching}>
                        {dispatching && <Loader2 className="size-4 animate-spin" />}
                        {!isOnline ? 'Guardar offline' : 'Confirmar despacho'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {showPaymentAction && (
            <>
              <Button variant="outline" className="w-full" onClick={() => setShowPayment(!showPayment)}>
                <CreditCard className="size-4" /> Registrar pago
              </Button>
              {showPayment && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Registrar pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={paymentForm.handleSubmit(onPayment)} className="space-y-4">
                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const isLocked = index < lockedCount
                          const line = watchedLines[index]
                          const lineCurrency = currenciesData?.currencies.find((c: any) => c.id === line?.currencyId)
                          const lineAmount = parseFloat(line?.amount ?? '0')
                          const lineInBase = lineCurrency && !isNaN(lineAmount) && lineAmount > 0
                            ? lineAmount / parseFloat(lineCurrency.exchangeRate)
                            : null
                          // lineInBase está en moneda base — convertir a la moneda del ticket,
                          // que es la que se muestra y se etiqueta debajo.
                          const lineInTicketCurrency = lineInBase !== null ? lineInBase * ticketCurrencyRate : null
                          const showLineConversion = !isLocked && lineInTicketCurrency !== null && lineCurrency?.id !== ticketCurrency?.id

                          return (
                            <div
                              key={field.id}
                              className={cn(
                                'rounded-lg border p-3 space-y-2.5',
                                isLocked && 'bg-muted/40 border-muted'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">Pago {index + 1}</span>
                                  {isLocked && <span className="text-xs font-medium text-green-600">✓ Confirmado</span>}
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => handleRemove(index)}>
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Método</Label>
                                  <select {...paymentForm.register(`lines.${index}.paymentMethod`)} className={selectClass} disabled={isLocked}>
                                    {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                                      <option key={v} value={v}>{l}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs">Moneda</Label>
                                    {!isLocked && lineCurrency && pendingForActiveLine > 0 && (
                                      <span className="text-xs font-medium text-amber-600">
                                        {lineCurrency.symbol}{' '}
                                        {(pendingForActiveLine * parseFloat(lineCurrency.exchangeRate))
                                          .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                  <select {...paymentForm.register(`lines.${index}.currencyId`)} className={selectClass} disabled={isLocked}>
                                    <option value="">Seleccionar...</option>
                                    {currenciesData?.currencies.map((c: any) => (
                                      <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Monto</Label>
                                <Input type="number" step="0.01" placeholder="0.00" {...paymentForm.register(`lines.${index}.amount`)} disabled={isLocked} />
                              </div>
                              {showLineConversion && (
                                <p className="text-xs text-amber-600">
                                  ≈ {ticketCurrency?.symbol}{' '}
                                  {(lineInTicketCurrency!).toLocaleString(undefined, { minimumFractionDigits: 2 })} en la moneda del ticket
                                </p>
                              )}
                              {!isLocked && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Referencia (opcional)</Label>
                                  <Input placeholder="Nro. de transacción" {...paymentForm.register(`lines.${index}.transactionReference`)} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAppend}>
                        <Plus className="size-4" /> Agregar otro método de pago
                      </Button>

                      <div className="rounded-lg bg-muted/30 border px-3 py-2 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total del ticket</span>
                          <span className="font-medium">
                            {ticketCurrency?.symbol}{' '}
                            {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {alreadyPaidInBase > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ya pagado</span>
                            <span>
                              {ticketCurrency?.symbol}{' '}
                              {(alreadyPaidInBase * ticketCurrencyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pendiente antes de este pago</span>
                          <span className="font-medium">
                            {ticketCurrency?.symbol}{' '}
                            {(remainingInBase * ticketCurrencyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total ingresado (equiv.)</span>
                          <span className={cn('font-medium', formIsCovered ? 'text-green-600' : '')}>
                            {ticketCurrency?.symbol}{' '}
                            {(totalEnteredInBase * ticketCurrencyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {!formIsCovered && totalEnteredInBase > 0 && (
                          <div className="flex justify-between text-destructive text-xs">
                            <span>Falta</span>
                            <span>
                              {ticketCurrency?.symbol}{' '}
                              {(formRemainingInBase * ticketCurrencyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {formIsCovered && <p className="text-xs text-green-600 font-medium">✓ Pago cubierto</p>}
                        {ticket.paymentMode === 'POSTPAID' && formIsCovered && totalEnteredInBase > remainingInBase && (
                          <p className="text-xs text-muted-foreground">El excedente queda como diferencial a favor de la estación.</p>
                        )}
                      </div>

                      <Button type="submit" size="sm" disabled={paying}>
                        {paying && <Loader2 className="size-4 animate-spin" />}
                        {!isOnline ? 'Guardar pago offline' : `Confirmar pago${fields.length > 1 ? 's' : ''}`}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {open && can(user, 'cancelTicket') && (
        <Button variant="outline" className="w-full" onClick={() => setConfirmCancel(true)} disabled={canceling}>
          <XCircle className="size-4" /> Cancelar ticket
        </Button>
      )}

      {/* Diferencial y devolución (solo COMPLETED) */}
      {completed && differential && can(user, 'viewDifferential') && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Diferencial a favor de la estación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagado</span>
              <span>{parseFloat(differential.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} (base)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Despachado</span>
              <span>{parseFloat(differential.dispatchedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} (base)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Devuelto</span>
              <span>{parseFloat(differential.refundedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} (base)</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>Diferencial pendiente</span>
              <span className={cn(pendingRefundInBase > 0 && 'text-amber-600')}>
                {pendingRefundInBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} base
                {' '}({parseFloat(differential.differentialLiters).toLocaleString(undefined, { maximumFractionDigits: 3 })} L)
              </span>
            </div>

            {refunds.length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Devoluciones</p>
                {refunds.map((r: any) => (
                  <div key={r.id} className="flex justify-between text-xs">
                    <span>{PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}</span>
                    <span>{r.currency.symbol} {parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}

            {pendingRefundInBase > 0.001 && can(user, 'refundTicket') && (
              <>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRefund(!showRefund)}>
                  <Undo2 className="size-4" /> Registrar devolución
                </Button>
                {showRefund && (
                  <form onSubmit={refundForm.handleSubmit(onRefundSubmit)} className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Monto a devolver (en {ticketCurrency?.symbol}) *</Label>
                      <Input type="number" step="0.01" placeholder="0.00" {...refundForm.register('amount')} />
                      {refundForm.formState.errors.amount && (
                        <p className="text-xs text-destructive">{refundForm.formState.errors.amount.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Método *</Label>
                      <select {...refundForm.register('paymentMethod')} className={selectClass}>
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Notas (opcional)</Label>
                      <Input placeholder="Observaciones..." {...refundForm.register('notes')} />
                    </div>
                    <Button type="submit" size="sm" disabled={refunding}>
                      {refunding && <Loader2 className="size-4 animate-spin" />}
                      {!isOnline ? 'Guardar offline' : 'Registrar devolución'}
                    </Button>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="¿Cancelar este ticket?"
        description="El ticket quedará cancelado y no se podrá despachar ni cobrar. Esta acción no se puede deshacer."
        confirmLabel="Cancelar ticket"
        destructive
        onConfirm={() => {
          setConfirmCancel(false)
          onCancel()
        }}
      />

      <ConfirmDialog
        open={!!confirmRefund}
        onOpenChange={(open) => !open && setConfirmRefund(null)}
        title="¿Registrar esta devolución?"
        description={
          confirmRefund
            ? `Se devolverán ${ticketCurrency?.symbol} ${parseFloat(confirmRefund.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Registrar devolución"
        destructive
        onConfirm={() => confirmRefund && doRefund(confirmRefund)}
      />
    </div>
  )
}
