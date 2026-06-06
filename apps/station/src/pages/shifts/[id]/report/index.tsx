import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { ArrowLeft } from 'lucide-react'
import { QUERIES as ShiftQueries } from '@/services/graphql/gql/employeeShift'
import { QUERIES as ReadingQueries } from '@/services/graphql/gql/dispenserReading'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

const SHIFT_TICKETS_WITH_PAYMENTS = gql`
  query ShiftTicketsForReport($cashierShiftId: UUID!) {
    salesTicketsByCashierShift(cashierShiftId: $cashierShiftId) {
      id
      ticketNumber
      status
      requestedLiters
      actualLitersDispatched
      totalAmountExpected
      dispenserNozzleId
      fuelType { id name }
      assignedSaleTypeConfig {
        saleTypeName
        currency { id symbol exchangeRate }
      }
      dispatcherEmployee { id firstName lastName }
      dispenserNozzle { id name }
      payments {
        id
        amount
        paymentMethod
        exchangeRateAtPayment
        currency { id symbol }
      }
    }
  }
`

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  MOBILE_PAYMENT: 'Pago móvil',
  BANK_TRANSFER: 'Transferencia bancaria',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function paymentBaseTotal(payments: any[]): number {
  return payments.reduce((s: number, p: any) => {
    const rate = parseFloat(p.exchangeRateAtPayment)
    return s + (rate > 0 ? parseFloat(p.amount) / rate : 0)
  }, 0)
}

export default function ShiftReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: shiftData, loading: loadingShift } = useQuery<{ employeeShift: any }>(
    ShiftQueries.employeeShift, { variables: { id }, skip: !id }
  )
  const { data: ticketsData, loading: loadingTickets } = useQuery<{ salesTicketsByCashierShift: any[] }>(
    SHIFT_TICKETS_WITH_PAYMENTS, { variables: { cashierShiftId: id }, skip: !id }
  )
  const { data: readingsData, loading: loadingReadings } = useQuery<{ dispenserReadingsByShift: any[] }>(
    ReadingQueries.dispenserReadingsByShift, { variables: { employeeShiftId: id }, skip: !id }
  )

  const loading = loadingShift || loadingTickets || loadingReadings
  if (loading) return <Skeleton className="h-96 w-full max-w-2xl" />

  const shift = shiftData?.employeeShift
  const tickets: any[] = ticketsData?.salesTicketsByCashierShift ?? []
  const readings: any[] = readingsData?.dispenserReadingsByShift ?? []

  if (!shift) return <p className="text-sm text-muted-foreground">Turno no encontrado.</p>

  const startTime = new Date(shift.shiftStartTime)
  const endTime = shift.shiftEndTime ? new Date(shift.shiftEndTime) : new Date()
  const durationMin = differenceInMinutes(endTime, startTime)

  const initialReadings = readings.filter((r) => r.readingType === 'INITIAL')
  const finalReadings   = readings.filter((r) => r.readingType === 'FINAL')
  const nozzleIds = [...new Set(readings.map((r) => r.dispenserNozzleId))]
  const readingRows = nozzleIds.map((nid) => {
    const ini  = initialReadings.find((r) => r.dispenserNozzleId === nid)
    const fin  = finalReadings.find((r) => r.dispenserNozzleId === nid)
    const diff = ini && fin ? parseFloat(fin.meterReading) - parseFloat(ini.meterReading) : null
    return { nozzle: (ini ?? fin)?.dispenserNozzle, ini, fin, diff }
  })
  const totalLitersFromMeters = readingRows.reduce((s, r) => s + (r.diff ?? 0), 0)

  const completed = tickets.filter((t) => t.status === 'COMPLETED')
  const cancelled  = tickets.filter((t) => t.status === 'CANCELED')
  const pending    = tickets.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELED')

  const totalLitersFromTickets = completed.reduce(
    (s, t) => s + parseFloat(t.actualLitersDispatched ?? t.requestedLiters ?? '0'), 0
  )
  const variance = totalLitersFromMeters > 0 ? totalLitersFromMeters - totalLitersFromTickets : null

  const allPayments: any[] = completed.flatMap((t) => t.payments ?? [])

  const byCurrency: Record<string, { symbol: string; total: number; baseTotal: number }> = {}
  for (const p of allPayments) {
    const sym    = p.currency.symbol
    const amount = parseFloat(p.amount)
    const rate   = parseFloat(p.exchangeRateAtPayment)
    if (!byCurrency[sym]) byCurrency[sym] = { symbol: sym, total: 0, baseTotal: 0 }
    byCurrency[sym].total     += amount
    byCurrency[sym].baseTotal += rate > 0 ? amount / rate : 0
  }
  const totalBaseCollected = Object.values(byCurrency).reduce((s, c) => s + c.baseTotal, 0)

  const byMethod: Record<string, Record<string, number>> = {}
  for (const p of allPayments) {
    const method = p.paymentMethod
    const sym    = p.currency.symbol
    if (!byMethod[method]) byMethod[method] = {}
    byMethod[method][sym] = (byMethod[method][sym] ?? 0) + parseFloat(p.amount)
  }

  const byFuel: Record<string, { name: string; liters: number; baseAmount: number }> = {}
  for (const t of completed) {
    const name  = t.fuelType.name
    const liters = parseFloat(t.actualLitersDispatched ?? t.requestedLiters ?? '0')
    const base   = paymentBaseTotal(t.payments ?? [])
    if (!byFuel[name]) byFuel[name] = { name, liters: 0, baseAmount: 0 }
    byFuel[name].liters     += liters
    byFuel[name].baseAmount += base
  }

  const byDispatcher: Record<string, { name: string; tickets: number; liters: number; baseAmount: number }> = {}
  for (const t of completed) {
    if (!t.dispatcherEmployee) continue
    const key   = t.dispatcherEmployee.id
    const name  = `${t.dispatcherEmployee.firstName} ${t.dispatcherEmployee.lastName}`
    const liters = parseFloat(t.actualLitersDispatched ?? '0')
    const base   = paymentBaseTotal(t.payments ?? [])
    if (!byDispatcher[key]) byDispatcher[key] = { name, tickets: 0, liters: 0, baseAmount: 0 }
    byDispatcher[key].tickets    += 1
    byDispatcher[key].liters     += liters
    byDispatcher[key].baseAmount += base
  }

  const byNozzle: Record<string, { name: string; tickets: number; liters: number }> = {}
  for (const t of completed) {
    if (!t.dispenserNozzle) continue
    const key   = t.dispenserNozzleId
    const name  = t.dispenserNozzle.name
    const liters = parseFloat(t.actualLitersDispatched ?? '0')
    if (!byNozzle[key]) byNozzle[key] = { name, tickets: 0, liters: 0 }
    byNozzle[key].tickets += 1
    byNozzle[key].liters  += liters
  }

  const baseSymbol = completed[0]?.assignedSaleTypeConfig?.currency?.symbol
    ?? Object.values(byCurrency)[0]?.symbol
    ?? '$'

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Reporte de cierre de turno"
        description={`${shift.employee.firstName} ${shift.employee.lastName} · ${shift.gasStation.name}`}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p className="font-medium">{format(startTime, 'HH:mm')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cierre</p>
            <p className="font-medium">
              {shift.shiftEndTime
                ? format(endTime, 'HH:mm')
                : <span className="text-amber-600">Turno activo</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duración</p>
            <p className="font-medium">{fmtDuration(durationMin)}</p>
          </div>
          <div className="col-span-3">
            <p className="text-xs text-muted-foreground">Fecha</p>
            <p className="font-medium capitalize">
              {format(startTime, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        </CardContent>
      </Card>

      {readingRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Lecturas de surtidores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pb-1 border-b mb-1">
                <span className="col-span-2">Boquilla</span>
                <span className="text-right">Inicial</span>
                <span className="text-right">Final / +Litros</span>
              </div>
              {readingRows.map(({ nozzle, ini, fin, diff }, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-center py-1.5 border-b last:border-0">
                  <span className="col-span-2">{nozzle?.name ?? '—'}</span>
                  <span className="text-right font-mono text-xs text-muted-foreground">
                    {ini ? fmt(parseFloat(ini.meterReading)) : '—'}
                  </span>
                  <div className="text-right">
                    {fin && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {fmt(parseFloat(fin.meterReading))}
                      </p>
                    )}
                    {diff !== null
                      ? <p className="text-xs font-semibold text-amber-600">+{fmt(diff)} L</p>
                      : <p className="text-xs text-muted-foreground">Sin lectura final</p>}
                  </div>
                </div>
              ))}
              {totalLitersFromMeters > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-2 font-semibold text-sm">
                  <span className="col-span-3">Total por medidores</span>
                  <span className="text-right">{fmt(totalLitersFromMeters)} L</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Tickets de venta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/30 border px-3 py-2 text-center">
              <p className="text-2xl font-bold">{completed.length}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
            <div className="rounded-lg bg-muted/30 border px-3 py-2 text-center">
              <p className="text-2xl font-bold text-destructive">{cancelled.length}</p>
              <p className="text-xs text-muted-foreground">Cancelados</p>
            </div>
            <div className="rounded-lg bg-muted/30 border px-3 py-2 text-center">
              <p className={cn('text-2xl font-bold', pending.length > 0 && 'text-amber-600')}>
                {pending.length}
              </p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </div>
          <div className="space-y-1 border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Litros despachados (tickets)</span>
              <span className="font-medium">{fmt(totalLitersFromTickets)} L</span>
            </div>
            {variance !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Varianza vs medidores</span>
                <span className={cn(
                  'font-medium text-xs',
                  Math.abs(variance) > 1 ? 'text-destructive' : 'text-green-600'
                )}>
                  {variance >= 0 ? '+' : ''}{fmt(variance)} L
                  {Math.abs(variance) <= 1 && ' ✓'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {Object.keys(byNozzle).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Despacho por boquilla
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-1 border-b mb-1">
              <span className="col-span-1">Boquilla</span>
              <span className="text-center">Tickets</span>
              <span className="text-right">Litros</span>
            </div>
            {Object.values(byNozzle).map((n) => (
              <div key={n.name} className="grid grid-cols-3 gap-2 py-1.5 border-b last:border-0">
                <span className="col-span-1">{n.name}</span>
                <span className="text-center text-muted-foreground">{n.tickets}</span>
                <span className="text-right font-medium">{fmt(n.liters)} L</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-2 font-semibold">
              <span>Total</span>
              <span className="text-center">
                {Object.values(byNozzle).reduce((s, n) => s + n.tickets, 0)}
              </span>
              <span className="text-right">{fmt(totalLitersFromTickets)} L</span>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(byDispatcher).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Despacho por bombero
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pb-1 border-b mb-1">
              <span className="col-span-2">Bombero</span>
              <span className="text-center">Tickets</span>
              <span className="text-right">Litros</span>
            </div>
            {Object.values(byDispatcher).map((d) => (
              <div key={d.name} className="grid grid-cols-4 gap-2 py-1.5 border-b last:border-0 items-center">
                <span className="col-span-2 font-medium">{d.name}</span>
                <span className="text-center text-muted-foreground">{d.tickets}</span>
                <span className="text-right font-medium">{fmt(d.liters)} L</span>
              </div>
            ))}
            {Object.keys(byDispatcher).length > 1 && (
              <div className="grid grid-cols-4 gap-2 pt-2 font-semibold">
                <span className="col-span-2">Total</span>
                <span className="text-center">
                  {Object.values(byDispatcher).reduce((s, d) => s + d.tickets, 0)}
                </span>
                <span className="text-right">{fmt(totalLitersFromTickets)} L</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Object.keys(byCurrency).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Recaudación por moneda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.values(byCurrency).map((c) => (
              <div key={c.symbol} className="flex justify-between items-center">
                <span className="font-medium">{c.symbol}</span>
                <div className="text-right">
                  <p className="font-medium">{c.symbol} {fmt(c.total)}</p>
                  {Object.keys(byCurrency).length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {baseSymbol} {fmt(c.baseTotal)} base
                    </p>
                  )}
                </div>
              </div>
            ))}
            {Object.keys(byCurrency).length > 1 && (
              <div className="flex justify-between items-center border-t pt-2 font-semibold">
                <span>Total equivalente base</span>
                <span>{baseSymbol} {fmt(totalBaseCollected)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Object.keys(byMethod).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Por método de pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(byMethod).map(([method, currencies]) => (
              <div key={method} className="flex justify-between items-start">
                <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                <div className="text-right space-y-0.5">
                  {Object.entries(currencies).map(([sym, total]) => (
                    <p key={sym} className="font-medium">{sym} {fmt(total)}</p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Object.keys(byFuel).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Por tipo de combustible
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-1 border-b mb-1">
              <span className="col-span-2">Combustible</span>
              <span className="text-right">Litros</span>
            </div>
            {Object.values(byFuel).map((f) => (
              <div key={f.name} className="grid grid-cols-3 gap-2 py-1.5 border-b last:border-0">
                <span className="col-span-2">{f.name}</span>
                <span className="text-right font-medium">{fmt(f.liters)} L</span>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-2 font-semibold">
              <span className="col-span-2">Total</span>
              <span className="text-right">{fmt(totalLitersFromTickets)} L</span>
            </div>
          </CardContent>
        </Card>
      )}

      {completed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No hay tickets completados en este turno.
        </p>
      )}
    </div>
  )
}
