import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Truck, CreditCard, XCircle, Plus, Trash2 } from 'lucide-react'
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
  const gasStationId = user?.assignedGasStation?.id ?? ''
  const [showDispatch, setShowDispatch] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [lockedCount, setLockedCount] = useState(0)

  const { data, loading } = useQuery<{ salesTicket: any }>(QUERIES.salesTicket, { variables: { id }, skip: !id })
  const { data: paymentsData } = useQuery<{ paymentsBySalesTicket: any[] }>(PaymentQueries.paymentsBySalesTicket, { variables: { salesTicketId: id }, skip: !id })
  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const { data: currenciesData } = useQuery<{ currencies: any[] }>(CurrencyQueries.currencies)
  const { data: dispensersData } = useQuery<{ dispensersByGasStation: any[] }>(DispenserQueries.dispensersByGasStation, {
    variables: { gasStationId },
    skip: !gasStationId,
  })

  const [processDispatch, { loading: dispatching }] = useMutation(MUTATIONS.processSalesTicketDispatch, {
    refetchQueries: [{ query: QUERIES.salesTicket, variables: { id } }],
  })
  const [createPayments, { loading: paying }] = useMutation(PaymentMutations.createPayments, {
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
    defaultValues: { lines: [EMPTY_LINE] },
  })
  const { fields, append, remove } = useFieldArray({ control: paymentForm.control, name: 'lines' })
  const watchedLines = paymentForm.watch('lines')

  const ticket = data?.salesTicket
  const payments: any[] = paymentsData?.paymentsBySalesTicket ?? []
  const stationEmployees = empData?.employees?.filter((e: any) => e.gasStation?.id === gasStationId) ?? []

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
  const formRemainingInBase = totalExpectedInBase - totalEnteredInBase
  const formIsCovered = totalEnteredInBase >= totalExpectedInBase

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
      await createPayments({
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
      })
      toast.success('Pago(s) registrado(s).')
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
      await completeTicket({ variables: { id } })
      toast.success('Ticket completado.')
      navigate(`/shifts/${ticket?.cashierShiftId}`)
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

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title={`Ticket #${ticket.ticketNumber}`}
        description={`${ticket.fuelType.name} · ${format(new Date(ticket.ticketIssueTime), 'dd/MM/yyyy HH:mm')}`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

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
            <span>Total a cobrar</span>
            <span>
              {ticketCurrency?.symbol}{' '}
              {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

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

      {isActive && (
        <div className="space-y-3">
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
                        Confirmar despacho
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </>
          )}

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
                      const showLineConversion = !isLocked && lineInBase !== null && lineCurrency?.id !== ticketCurrency?.id

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
                              {isLocked && (
                                <span className="text-xs font-medium text-green-600">✓ Confirmado</span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleRemove(index)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Método</Label>
                              <select
                                {...paymentForm.register(`lines.${index}.paymentMethod`)}
                                className={selectClass}
                                disabled={isLocked}
                              >
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
                              <select
                                {...paymentForm.register(`lines.${index}.currencyId`)}
                                className={selectClass}
                                disabled={isLocked}
                              >
                                <option value="">Seleccionar...</option>
                                {currenciesData?.currencies.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Monto</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...paymentForm.register(`lines.${index}.amount`)}
                              disabled={isLocked}
                            />
                          </div>
                          {showLineConversion && (
                            <p className="text-xs text-amber-600">
                              ≈ {ticketCurrency?.symbol}{' '}
                              {(lineInBase!).toLocaleString(undefined, { minimumFractionDigits: 2 })} en la moneda del ticket
                            </p>
                          )}
                          {!isLocked && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Referencia (opcional)</Label>
                              <Input
                                placeholder="Nro. de transacción"
                                {...paymentForm.register(`lines.${index}.transactionReference`)}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleAppend}
                  >
                    <Plus className="size-4" /> Agregar otro método de pago
                  </Button>

                  <div className="rounded-lg bg-muted/30 border px-3 py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total a cobrar</span>
                      <span className="font-medium">
                        {ticketCurrency?.symbol}{' '}
                        {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    {formIsCovered && (
                      <p className="text-xs text-green-600 font-medium">✓ Pago cubierto</p>
                    )}
                  </div>

                  <Button type="submit" size="sm" disabled={paying}>
                    {paying && <Loader2 className="size-4 animate-spin" />}
                    Confirmar pago{fields.length > 1 ? 's' : ''}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

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
