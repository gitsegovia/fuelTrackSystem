'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation, useQuery } from '@apollo/client/react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/tank'
import { QUERIES as TM_QUERIES } from '@/services/graphql/gql/tankModel'
import { QUERIES as FT_QUERIES } from '@/services/graphql/gql/fuelType'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const req = (label: string) =>
  z.string().min(1, `${label} es requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, `${label} debe ser un número válido`
  )

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  fuelTypeId: z.string().min(1, 'Selecciona un combustible'),
  tankModelId: z.string().min(1, 'Selecciona un modelo'),
  maxCapacityLiters: req('Capacidad máxima'),
  minOperatingVolumeLiters: req('Volumen mínimo operativo'),
  currentHeightCm: z.string().refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Valor inválido').optional(),
  currentVolumeLiters: z.string().refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Valor inválido').optional(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

export default function NewTankPage() {
  const { id: stationId } = useParams<{ id: string }>()
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment`

  const { data: tmData } = useQuery<{ tankModels: { id: string; name: string; nominalCapacity: string }[] }>(TM_QUERIES.tankModels)
  const { data: ftData } = useQuery<{ fuelTypes: { id: string; name: string }[] }>(FT_QUERIES.fuelTypes)
  const [create, { loading }] = useMutation(MUTATIONS.createTank, {
    refetchQueries: [{ query: QUERIES.tanksByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await create({
        variables: {
          input: {
            gasStationId: stationId,
            fuelTypeId: data.fuelTypeId,
            tankModelId: data.tankModelId,
            name: data.name,
            maxCapacityLiters: data.maxCapacityLiters,
            minOperatingVolumeLiters: data.minOperatingVolumeLiters,
            currentHeightCm: data.currentHeightCm || undefined,
            currentVolumeLiters: data.currentVolumeLiters || undefined,
          },
        },
      })
      toast.success('Tanque creado correctamente.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al crear.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo tanque" description="Añade un tanque a la estación" />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos del tanque</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" placeholder="Ej: Tanque A" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuelTypeId">Combustible *</Label>
              <select id="fuelTypeId" {...register('fuelTypeId')} className={selectClass}>
                <option value="">Seleccionar combustible...</option>
                {ftData?.fuelTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
              {errors.fuelTypeId && <p className="text-xs text-destructive">{errors.fuelTypeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankModelId">Modelo de tanque *</Label>
              <select id="tankModelId" {...register('tankModelId')} className={selectClass}>
                <option value="">Seleccionar modelo...</option>
                {tmData?.tankModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({parseFloat(m.nominalCapacity).toLocaleString()} L)</option>
                ))}
              </select>
              {errors.tankModelId && <p className="text-xs text-destructive">{errors.tankModelId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="maxCapacityLiters">Capacidad máx. (L) *</Label>
                <Input id="maxCapacityLiters" placeholder="10000" {...register('maxCapacityLiters')} aria-invalid={!!errors.maxCapacityLiters} />
                {errors.maxCapacityLiters && <p className="text-xs text-destructive">{errors.maxCapacityLiters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minOperatingVolumeLiters">Volumen mín. (L) *</Label>
                <Input id="minOperatingVolumeLiters" placeholder="500" {...register('minOperatingVolumeLiters')} aria-invalid={!!errors.minOperatingVolumeLiters} />
                {errors.minOperatingVolumeLiters && <p className="text-xs text-destructive">{errors.minOperatingVolumeLiters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentHeightCm">Altura actual (cm)</Label>
                <Input id="currentHeightCm" placeholder="0.00" {...register('currentHeightCm')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentVolumeLiters">Volumen actual (L)</Label>
                <Input id="currentVolumeLiters" placeholder="0.00" {...register('currentVolumeLiters')} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Crear tanque'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
