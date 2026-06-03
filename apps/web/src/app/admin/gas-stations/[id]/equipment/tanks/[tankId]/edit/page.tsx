'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@apollo/client/react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/tank'
import { QUERIES as TM_QUERIES } from '@/services/graphql/gql/tankModel'
import { QUERIES as FT_QUERIES } from '@/services/graphql/gql/fuelType'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  fuelTypeId: z.string().min(1, 'Selecciona un combustible'),
  tankModelId: z.string().min(1, 'Selecciona un modelo'),
  maxCapacityLiters: z.string().min(1, 'Requerido').refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser > 0'),
  minOperatingVolumeLiters: z.string().min(1, 'Requerido').refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Debe ser ≥ 0'),
  currentHeightCm: z.string().optional(),
  currentVolumeLiters: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

export default function EditTankPage() {
  const { id: stationId, tankId } = useParams<{ id: string; tankId: string }>()
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment`

  const { data, loading: fetching } = useQuery<{ tank: any }>(QUERIES.tank, { variables: { id: tankId }, skip: !tankId })
  const { data: tmData } = useQuery<{ tankModels: { id: string; name: string; nominalCapacity: string }[] }>(TM_QUERIES.tankModels)
  const { data: ftData } = useQuery<{ fuelTypes: { id: string; name: string }[] }>(FT_QUERIES.fuelTypes)
  const [update, { loading }] = useMutation(MUTATIONS.updateTank, {
    refetchQueries: [{ query: QUERIES.tanksByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.tank) {
      const t = data.tank
      reset({
        name: t.name,
        fuelTypeId: t.fuelTypeId,
        tankModelId: t.tankModelId,
        maxCapacityLiters: String(t.maxCapacityLiters),
        minOperatingVolumeLiters: String(t.minOperatingVolumeLiters),
        currentHeightCm: t.currentHeightCm ? String(t.currentHeightCm) : '',
        currentVolumeLiters: t.currentVolumeLiters ? String(t.currentVolumeLiters) : '',
      })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({
        variables: {
          id: tankId,
          input: {
            name: data.name, fuelTypeId: data.fuelTypeId, tankModelId: data.tankModelId,
            maxCapacityLiters: data.maxCapacityLiters, minOperatingVolumeLiters: data.minOperatingVolumeLiters,
            currentHeightCm: data.currentHeightCm || undefined,
            currentVolumeLiters: data.currentVolumeLiters || undefined,
          },
        },
      })
      toast.success('Tanque actualizado.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al actualizar.') }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6">
      <PageHeader title="Editar tanque" description={data?.tank?.name ?? ''} />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos del tanque</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Combustible *</Label>
              <select {...register('fuelTypeId')} className={selectClass}>
                <option value="">Seleccionar combustible...</option>
                {ftData?.fuelTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Modelo de tanque *</Label>
              <select {...register('tankModelId')} className={selectClass}>
                <option value="">Seleccionar modelo...</option>
                {tmData?.tankModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({parseFloat(m.nominalCapacity).toLocaleString()} L)</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Capacidad máx. (L) *</Label>
                <Input {...register('maxCapacityLiters')} aria-invalid={!!errors.maxCapacityLiters} />
                {errors.maxCapacityLiters && <p className="text-xs text-destructive">{errors.maxCapacityLiters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Volumen mín. (L) *</Label>
                <Input {...register('minOperatingVolumeLiters')} aria-invalid={!!errors.minOperatingVolumeLiters} />
                {errors.minOperatingVolumeLiters && <p className="text-xs text-destructive">{errors.minOperatingVolumeLiters.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Altura actual (cm)</Label>
                <Input {...register('currentHeightCm')} />
              </div>
              <div className="space-y-1.5">
                <Label>Volumen actual (L)</Label>
                <Input {...register('currentVolumeLiters')} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
