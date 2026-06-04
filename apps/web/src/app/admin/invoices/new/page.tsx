'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/invoice'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const decimal = (label: string) =>
  z.string().min(1, `${label} requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    `${label} debe ser mayor a 0`
  )

const schema = z.object({
  invoiceNumber: z.string().min(1, 'Requerido'),
  controlNumber: z.string().min(1, 'Requerido'),
  sealNumber: z.string().min(1, 'Requerido'),
  truckIdentifier: z.string().min(1, 'Requerido'),
  fuelKind: z.enum(['GASOLINE_91', 'GASOLINE_95', 'DIESEL', 'KEROSENE']),
  liters: decimal('Litros'),
  totalAmount: decimal('Monto total'),
  costPerLiter: decimal('Costo por litro'),
  dispatchDate: z.string().min(1, 'Requerido'),
  dispatchTime: z.string().min(1, 'Requerido'),
  dischargeDate: z.string().min(1, 'Requerido'),
  dischargeTime: z.string().min(1, 'Requerido'),
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  currencyId: z.string().min(1, 'Selecciona una moneda'),
})
type FormData = z.infer<typeof schema>

export default function NewInvoicePage() {
  const router = useRouter()
  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const { data: currenciesData } = useQuery<{ currencies: { id: string; name: string; symbol: string }[] }>(CurrencyQueries.currencies)
  const [create, { loading }] = useMutation(MUTATIONS.createInvoice, {
    refetchQueries: [{ query: QUERIES.invoices }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fuelKind: 'DIESEL' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create({
        variables: {
          input: {
            ...data,
            liters: parseFloat(data.liters),
            totalAmount: parseFloat(data.totalAmount),
            costPerLiter: parseFloat(data.costPerLiter),
            dispatchDate: new Date(`${data.dispatchDate}T${data.dispatchTime}`).toISOString(),
            dischargeDate: new Date(`${data.dischargeDate}T${data.dischargeTime}`).toISOString(),
          },
        },
      })
      toast.success('Factura registrada correctamente.')
      router.push('/admin/invoices')
    } catch (err: any) {
      toast.error(`No se pudo registrar la factura: ${err.message ?? ''}`)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nueva factura de despacho"
        description="Registra el combustible recibido de un proveedor"
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Datos del proveedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>N° Factura *</Label>
                <Input placeholder="0000001" {...register('invoiceNumber')} aria-invalid={!!errors.invoiceNumber} />
                {errors.invoiceNumber && <p className="text-xs text-destructive">{errors.invoiceNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>N° Control *</Label>
                <Input placeholder="00-0000001" {...register('controlNumber')} aria-invalid={!!errors.controlNumber} />
                {errors.controlNumber && <p className="text-xs text-destructive">{errors.controlNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>N° Precinto *</Label>
                <Input placeholder="ABC123" {...register('sealNumber')} aria-invalid={!!errors.sealNumber} />
                {errors.sealNumber && <p className="text-xs text-destructive">{errors.sealNumber.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Identificador del camión *</Label>
                <Input placeholder="AB-123CD" {...register('truckIdentifier')} aria-invalid={!!errors.truckIdentifier} />
                {errors.truckIdentifier && <p className="text-xs text-destructive">{errors.truckIdentifier.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de combustible *</Label>
                <select {...register('fuelKind')} className={selectClass}>
                  <option value="GASOLINE_91">Gasolina 91</option>
                  <option value="GASOLINE_95">Gasolina 95</option>
                  <option value="DIESEL">Diésel</option>
                  <option value="KEROSENE">Kerosene</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fecha de despacho *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" {...register('dispatchDate')} aria-invalid={!!errors.dispatchDate} />
                  <Input type="time" {...register('dispatchTime')} aria-invalid={!!errors.dispatchTime} />
                </div>
                {(errors.dispatchDate || errors.dispatchTime) && (
                  <p className="text-xs text-destructive">Fecha y hora requeridas</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de descarga *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" {...register('dischargeDate')} aria-invalid={!!errors.dischargeDate} />
                  <Input type="time" {...register('dischargeTime')} aria-invalid={!!errors.dischargeTime} />
                </div>
                {(errors.dischargeDate || errors.dischargeTime) && (
                  <p className="text-xs text-destructive">Fecha y hora requeridas</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Destino y montos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Estación receptora *</Label>
                <select {...register('gasStationId')} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {stationsData?.gasStations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.gasStationId && <p className="text-xs text-destructive">{errors.gasStationId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Moneda *</Label>
                <select {...register('currencyId')} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {currenciesData?.currencies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
                {errors.currencyId && <p className="text-xs text-destructive">{errors.currencyId.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Litros *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('liters')} aria-invalid={!!errors.liters} />
                {errors.liters && <p className="text-xs text-destructive">{errors.liters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Costo por litro *</Label>
                <Input type="number" step="0.0001" placeholder="0.0000" {...register('costPerLiter')} aria-invalid={!!errors.costPerLiter} />
                {errors.costPerLiter && <p className="text-xs text-destructive">{errors.costPerLiter.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Monto total *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('totalAmount')} aria-invalid={!!errors.totalAmount} />
                {errors.totalAmount && <p className="text-xs text-destructive">{errors.totalAmount.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Guardando...' : 'Registrar factura'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
