'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/saleTypeConfig'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as FuelTypeQueries } from '@/services/graphql/gql/fuelType'
import { QUERIES as CurrencyQueries } from '@/services/graphql/gql/currency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const decimalPositive = (label: string) =>
  z.string().min(1, `${label} es requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, `${label} debe ser un número válido`
  )

const schema = z.object({
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  fuelTypeId: z.string().min(1, 'Selecciona un combustible'),
  currencyId: z.string().min(1, 'Selecciona una moneda'),
  saleTypeName: z.enum(['REGULAR', 'PREMIUM', 'SUBSIDIZED']),
  salePricePerLiter: decimalPositive('El precio por litro'),
  percentage: decimalPositive('El porcentaje'),
})
type FormData = z.infer<typeof schema>

export default function NewSaleTypeConfigPage() {
  const router = useRouter()

  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const { data: fuelTypesData } = useQuery<{ fuelTypes: { id: string; name: string }[] }>(FuelTypeQueries.fuelTypes)
  const { data: currenciesData } = useQuery<{ currencies: { id: string; name: string; symbol: string }[] }>(CurrencyQueries.currencies)
  const [create, { loading }] = useMutation(MUTATIONS.createSaleTypeConfig, {
    refetchQueries: [{ query: QUERIES.saleTypeConfigs }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { saleTypeName: 'REGULAR' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create({ variables: { input: data } })
      toast.success('Configuración creada correctamente.')
      router.push('/admin/sale-type-configs')
    } catch (err: any) {
      toast.error(err.message?.includes('already exists') ? 'Ya existe una configuración con esa combinación.' : 'No se pudo crear la configuración.')
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Nueva configuración de venta"
        description="Define el precio y tipo de venta para un combustible en una estación"
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Estación *</Label>
              <select {...register('gasStationId')} className={selectClass}>
                <option value="">Seleccionar estación...</option>
                {stationsData?.gasStations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.gasStationId && <p className="text-xs text-destructive">{errors.gasStationId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Combustible *</Label>
              <select {...register('fuelTypeId')} className={selectClass}>
                <option value="">Seleccionar combustible...</option>
                {fuelTypesData?.fuelTypes.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.fuelTypeId && <p className="text-xs text-destructive">{errors.fuelTypeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de venta *</Label>
              <select {...register('saleTypeName')} className={selectClass}>
                <option value="REGULAR">Regular</option>
                <option value="PREMIUM">Premium</option>
                <option value="SUBSIDIZED">Subsidiado</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Moneda *</Label>
              <select {...register('currencyId')} className={selectClass}>
                <option value="">Seleccionar moneda...</option>
                {currenciesData?.currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                ))}
              </select>
              {errors.currencyId && <p className="text-xs text-destructive">{errors.currencyId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Precio por litro *</Label>
                <Input placeholder="0.00" {...register('salePricePerLiter')} aria-invalid={!!errors.salePricePerLiter} />
                {errors.salePricePerLiter && <p className="text-xs text-destructive">{errors.salePricePerLiter.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Porcentaje *</Label>
                <Input placeholder="0.00" {...register('percentage')} aria-invalid={!!errors.percentage} />
                {errors.percentage && <p className="text-xs text-destructive">{errors.percentage.message}</p>}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear configuración'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
