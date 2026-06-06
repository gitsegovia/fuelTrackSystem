import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, WifiOff } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/salesTicket'
import { QUERIES as FuelTypeQueries } from '@/services/graphql/gql/fuelType'
import { QUERIES as SaleTypeConfigQueries } from '@/services/graphql/gql/saleTypeConfig'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { useOffline } from '@/context/OfflineContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Fragmento mínimo para escribir el ticket en cache offline
const SALES_TICKET_CACHE_FRAGMENT = gql`
  fragment NewTicketOffline on SalesTicket {
    id ticketNumber status requestedLiters totalAmountExpected
    ticketIssueTime fuelTypeId cashierShiftId gasStationId
    actualLitersDispatched dispenserNozzleId dispatcherEmployeeId
    fuelType { id name }
    assignedSaleTypeConfig {
      id saleTypeName
      salePricePerLiter
      currency { id symbol exchangeRate }
    }
  }
`

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  fuelTypeId: z.string().min(1, 'Selecciona un combustible'),
  assignedSaleTypeConfigId: z.string().min(1, 'Selecciona el tipo de venta'),
  requestedLiters: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
})
type FormData = z.infer<typeof schema>

export default function NewTicketPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const shiftId = searchParams.get('shiftId') ?? ''
  const { user } = useAuth()
  const { isOnline } = useOffline()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: fuelTypesData } = useQuery<{ fuelTypes: { id: string; name: string }[] }>(FuelTypeQueries.fuelTypes)
  const { data: configsData } = useQuery<{ saleTypeConfigs: any[] }>(SaleTypeConfigQueries.saleTypeConfigs)

  const [create, { loading }] = useOfflineMutation<
    { createSalesTicket: { id: string; ticketNumber: number } }
  >(MUTATIONS.createSalesTicket, {
    refetchQueries: [
      { query: QUERIES.salesTicketsByGasStation, variables: { gasStationId } },
      ...(shiftId ? [{ query: QUERIES.salesTicketsByCashierShift, variables: { cashierShiftId: shiftId } }] : []),
    ],
    // Escribe el ticket en cache Apollo para que el detalle lo encuentre offline
    writeToCache: (cache, { variables, localId }) => {
      if (!localId || !variables) return
      const input = (variables as any).input
      const selectedConfig = configsData?.saleTypeConfigs?.find((c: any) => c.id === input?.assignedSaleTypeConfigId)
      const fuelType = fuelTypesData?.fuelTypes?.find((f) => f.id === input?.fuelTypeId)
      if (!selectedConfig || !fuelType) return
      try {
        cache.writeFragment({
          id: `SalesTicket:${localId}`,
          fragment: SALES_TICKET_CACHE_FRAGMENT,
          data: {
            id: localId,
            ticketNumber: 0,
            status: 'PENDING_PAYMENT_DISPATCH',
            requestedLiters: String(input.requestedLiters),
            totalAmountExpected: String(input.totalAmountExpected),
            ticketIssueTime: input.ticketIssueTime,
            fuelTypeId: input.fuelTypeId,
            cashierShiftId: input.cashierShiftId,
            gasStationId: input.gasStationId,
            actualLitersDispatched: null,
            dispenserNozzleId: null,
            dispatcherEmployeeId: null,
            fuelType: { __typename: 'FuelType', id: fuelType.id, name: fuelType.name },
            assignedSaleTypeConfig: {
              __typename: 'SaleTypeConfig',
              id: selectedConfig.id,
              saleTypeName: selectedConfig.saleTypeName,
              salePricePerLiter: selectedConfig.salePricePerLiter,
              currency: {
                __typename: 'Currency',
                id: selectedConfig.currency.id,
                symbol: selectedConfig.currency.symbol,
                exchangeRate: selectedConfig.currency.exchangeRate,
              },
            },
            __typename: 'SalesTicket',
          },
        })
      } catch (e) {
        console.warn('[FuelTrack] writeToCache ticket failed:', e)
      }
    },
  })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const selectedFuelTypeId = watch('fuelTypeId')
  const selectedConfigId = watch('assignedSaleTypeConfigId')

  const stationConfigs = configsData?.saleTypeConfigs?.filter(
    (c) => c.gasStation?.id === gasStationId
  ) ?? []
  const filteredConfigs = selectedFuelTypeId
    ? stationConfigs.filter((c) => c.fuelType?.id === selectedFuelTypeId)
    : stationConfigs
  const selectedConfig = stationConfigs.find((c) => c.id === selectedConfigId)

  const requestedLiters = parseFloat(watch('requestedLiters') || '0')
  const pricePerLiter = selectedConfig ? parseFloat(selectedConfig.salePricePerLiter) : 0
  const totalAmount = isNaN(requestedLiters) ? 0 : requestedLiters * pricePerLiter

  const onSubmit = async (data: FormData) => {
    if (!shiftId) {
      toast.error('No hay turno activo. Inicia un turno primero.')
      return
    }
    try {
      // localId generado aquí: identifica este ticket en la cola offline.
      // Si se crea online, el servidor asigna su propio UUID y localId queda sin usar.
      // Si se crea offline, localId viaja como dependsOn en dispatch/payment.
      const localId = crypto.randomUUID()

      const { data: result, wasQueued } = await create({
        variables: {
          input: {
            gasStationId,
            cashierShiftId: shiftId,
            fuelTypeId: data.fuelTypeId,
            assignedSaleTypeConfigId: data.assignedSaleTypeConfigId,
            requestedLiters: parseFloat(data.requestedLiters),
            ticketIssueTime: new Date().toISOString(),
            totalAmountExpected: totalAmount,
          },
        },
        localId,
        optimisticResponse: {
          createSalesTicket: { id: localId, ticketNumber: 0 },
        },
      })

      const ticket = result!.createSalesTicket

      if (wasQueued) {
        toast.success('Ticket guardado. Se enviará al servidor cuando vuelva la conexión.')
      } else {
        toast.success(`Ticket #${ticket.ticketNumber} creado.`)
      }

      const canActOnTicket = ['Cashier', 'FuelAttendant'].includes(user?.userType ?? '')
      if (canActOnTicket) {
        // ticket.id = localId si offline, UUID real si online — ambos funcionan
        navigate(`/tickets/${ticket.id}`)
      } else {
        navigate(`/shifts/${shiftId}`)
      }
    } catch (err: any) {
      toast.error(`No se pudo crear el ticket: ${err.message ?? ''}`)
    }
  }

  return (
    <div className="space-y-6 max-w-sm">
      <PageHeader
        title="Nuevo ticket de venta"
        description="Registra una solicitud de despacho"
        action={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {!shiftId && (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          Debes tener un turno activo para crear tickets.
        </p>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <WifiOff className="size-4 shrink-0" />
          <span>Sin conexión — el ticket se guardará localmente y se sincronizará al reconectar.</span>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Combustible *</Label>
              <select {...register('fuelTypeId')} className={selectClass}>
                <option value="">Seleccionar...</option>
                {fuelTypesData?.fuelTypes.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.fuelTypeId && <p className="text-xs text-destructive">{errors.fuelTypeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de venta *</Label>
              <select {...register('assignedSaleTypeConfigId')} className={selectClass} disabled={!selectedFuelTypeId}>
                <option value="">Seleccionar...</option>
                {filteredConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.saleTypeName} — {c.currency?.symbol} {parseFloat(c.salePricePerLiter).toFixed(4)}/L
                  </option>
                ))}
              </select>
              {errors.assignedSaleTypeConfigId && <p className="text-xs text-destructive">{errors.assignedSaleTypeConfigId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Litros solicitados *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('requestedLiters')} aria-invalid={!!errors.requestedLiters} />
              {errors.requestedLiters && <p className="text-xs text-destructive">{errors.requestedLiters.message}</p>}
            </div>

            {selectedConfig && requestedLiters > 0 && (
              <div className="rounded-lg bg-muted/30 border px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precio/litro</span>
                  <span>{selectedConfig.currency?.symbol} {pricePerLiter.toFixed(4)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total esperado</span>
                  <span>{selectedConfig.currency?.symbol} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !shiftId}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : !isOnline ? 'Guardar offline' : 'Crear ticket'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
