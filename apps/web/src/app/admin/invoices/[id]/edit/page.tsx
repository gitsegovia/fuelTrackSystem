'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/invoice'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

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
  dischargeDate: z.string().min(1, 'Requerido'),
  gasStationId: z.string().min(1, 'Requerido'),
  currencyId: z.string().min(1, 'Requerido'),
})
type FormData = z.infer<typeof schema>

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ invoice: any }>(QUERIES.invoice, { variables: { id }, skip: !id })
  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const { data: currenciesData } = useQuery<{ currencies: { id: string; name: string; symbol: string }[] }>(CurrencyQueries.currencies)
  const [update, { loading }] = useMutation(MUTATIONS.updateInvoice, {
    refetchQueries: [{ query: QUERIES.invoices }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.invoice) {
      const inv = data.invoice
      reset({
        invoiceNumber: inv.invoiceNumber,
        controlNumber: inv.controlNumber,
        sealNumber: inv.sealNumber,
        truckIdentifier: inv.truckIdentifier,
        fuelKind: inv.fuelKind,
        liters: String(inv.liters),
        totalAmount: String(inv.totalAmount),
        costPerLiter: String(inv.costPerLiter),
        dispatchDate: format(new Date(inv.dispatchDate), "yyyy-MM-dd'T'HH:mm"),
        dischargeDate: format(new Date(inv.dischargeDate), "yyyy-MM-dd'T'HH:mm"),
        gasStationId: inv.receivingGasStation.id,
        currencyId: inv.currency.id,
      })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({
        variables: {
          id,
          input: {
            ...data,
            liters: parseFloat(data.liters),
            totalAmount: parseFloat(data.totalAmount),
            costPerLiter: parseFloat(data.costPerLiter),
            dispatchDate: new Date(data.dispatchDate).toISOString(),
            dischargeDate: new Date(data.dischargeDate).toISOString(),
          },
        },
      })
      toast.success('Factura actualizada correctamente.')
      router.push('/admin/invoices')
    } catch (err: any) {
      toast.error(`No se pudo actualizar: ${err.message ?? ''}`)
    }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-2xl" />

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Editar factura"
        description={data?.invoice?.invoiceNumber ?? ''}
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
              {(['invoiceNumber', 'controlNumber', 'sealNumber'] as const).map((field, i) => (
                <div key={field} className="space-y-1.5">
                  <Label>{['N° Factura', 'N° Control', 'N° Precinto'][i]} *</Label>
                  <Input {...register(field)} aria-invalid={!!errors[field]} />
                  {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Camión *</Label>
                <Input {...register('truckIdentifier')} aria-invalid={!!errors.truckIdentifier} />
                {errors.truckIdentifier && <p className="text-xs text-destructive">{errors.truckIdentifier.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Combustible *</Label>
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
                <Label>Fecha despacho *</Label>
                <Input type="datetime-local" {...register('dispatchDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha descarga *</Label>
                <Input type="datetime-local" {...register('dischargeDate')} />
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
                <Label>Estación *</Label>
                <select {...register('gasStationId')} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {stationsData?.gasStations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Moneda *</Label>
                <select {...register('currencyId')} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {currenciesData?.currencies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(['liters', 'costPerLiter', 'totalAmount'] as const).map((field, i) => (
                <div key={field} className="space-y-1.5">
                  <Label>{['Litros', 'Costo/litro', 'Total'][i]} *</Label>
                  <Input type="number" step={i === 1 ? '0.0001' : '0.01'} {...register(field)} aria-invalid={!!errors[field]} />
                  {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}
