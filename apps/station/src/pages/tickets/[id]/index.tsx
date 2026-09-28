import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Truck, CreditCard, XCircle, Plus, Trash2, WifiOff } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/salesTicket'
import { MUTATIONS as PaymentMutations, QUERIES as PaymentQueries } from '@/services/graphql/gql/payment'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { QUERIES as DispenserQueries } from '@/services/graphql/gql/dispenser'
import { TICKET_STATUS_LABELS } from '@/lib/ticket-status'
import { useAuth } from '@/hooks/useAuth'
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

type DispatchForm = z.infer<typeof dispatchSchema>
type PaymentForm = z.infer<typeof paymentSchema>

const EMPTY_LINE = { paymentMethod: 'CASH' as const, amount: '', currencyId: '', transactionReference: '' }

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const gasStationId = user?.assignedGasStation?.id ?? ''
  const [showDispatch, setShowDispatch] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [lockedCount, setLockedCount] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)

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

  // Dispatch — el ticket (id) puede ser un localId si fue creado offline.
  // dependsOn: id captura eso: cuando el sync procese createSalesTicket primero
  // y obtenga el ID real, remapeará id → ID real en esta mutation también.
  // Offline, cada operación refleja en el cache el efecto que tendrá en el servidor (optimista;
  // el refetch posterior al sync lo reemplaza). Así la UI no ofrece repetirla.
  const ticketCacheId = { __typename: 'SalesTicket', id }
  const setTicketStatus = (cache: any, status: string) =>
    cache.modify({ id: cache.identify(ticketCacheId), fields: { status: () => status } })

  const [processDispatch, { loading: dispatching }] = useOfflineMutation(
    MUTATIONS.processSalesTicketDispatch,
    {
      refetchQueries: [{ query: QUERIES.salesTicket, variables: { id } }],
      // Como el servidor: guarda el despacho, recalcula el total con los litros reales y
      // pasa de PENDING_PAYMENT_DISPATCH a PAID_PENDING_DISPATCH.
      writeToCache: (cache, { variables }) => {
        if (!variables) return
        const liters = Number(variables.actualLitersDispatched)
        const price = parseFloat(ticket?.assignedSaleTypeConfig?.salePricePerLiter ?? 'NaN')
        cache.modify({
          id: cache.identify(ticketCacheId),
          fields: {
            actualLitersDispatched: () => String(liters),
            dispatcherEmployeeId: () => variables.dispatcherEmployeeId,
            dispenserNozzleId: () => variables.dispenserNozzleId,
            totalAmountExpected: (prev: string) => (isNaN(price) ? prev : String(liters * price)),
            status: (prev: string) => (prev === 'PENDING_PAYMENT_DISPATCH' ? 'PAID_PENDING_DISPATCH' : prev),
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
      // Como el servidor: cada línea toma la tasa actual de su moneda y, si el total pagado
      // en base cubre el total del ticket, el ticket pasa a COMPLETED.
      writeToCache: (cache, { variables }) => {
        if (!variables) return
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
        if (ticket && ticket.status !== 'CANCELED' && paidInBase >= totalExpectedInBase) {
          setTicketStatus(cache, 'COMPLETED')
        }
      },
    }
  )

  const [completeTicket, { loading: completing }] = useOfflineMutation(
    MUTATIONS.completeSalesTicketPayment,
    {
      refetchQueries: [
        { query: QUERIES.salesTicket, variables: { id } },
        { query: QUERIES.salesTicketsByGasStation, variables: { gasStationId } },
      ],
      writeToCache: (cache) => setTicketStatus(cache, 'COMPLETED'),
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

  const dispatchForm = useForm<DispatchForm>({ resolver: zodResolver(dispatchSchema) })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { lines: [EMPTY_LINE] },
  })
  const { fields, append, remove } = useFieldArray({ control: paymentForm.control, name: 'lines' })
  const watchedLines = paymentForm.watch('lines')

  const ticket = data?.salesTicket
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

  const onDispatch = async (formData: DispatchForm) => {
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

  const onComplete = async () => {
    try {
      const { wasQueued } = await completeTicket({
        variables: { id },
        dependsOn: id,
        optimisticResponse: { completeSalesTicketPayment: { id } },
      })
      if (!wasQueued) {
        toast.success('Ticket completado.')
        navigate(`/shifts/${ticket?.cashierShiftId}`)
      } else {
        toast.success('Completar ticket guardado offline.')
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message ?? ''}`)
    }
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

  const isActive = ticket.status !== 'COMPLETED' && ticket.status !== 'CANCELED'

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

      {/* Acciones (solo si el ticket está activo) */}
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
                      // que es la que se muestra y se etiqueta debajo (antes mostraba el
                      // monto en base con la etiqueta de "moneda del ticket").
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
                  </div>

                  <Button type="submit" size="sm" disabled={paying}>
                    {paying && <Loader2 className="size-4 animate-spin" />}
                    {!isOnline ? 'Guardar pago offline' : `Confirmar pago${fields.length > 1 ? 's' : ''}`}
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
            <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={canceling}>
              <XCircle className="size-4" /> Cancelar
            </Button>
          </div>
        </div>
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
    </div>
  )
}
