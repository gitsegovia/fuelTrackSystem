'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@apollo/client/react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/dispenser'
import { QUERIES as TANK_QUERIES } from '@/services/graphql/gql/tank'
import { QUERIES as ISLAND_QUERIES } from '@/services/graphql/gql/pumpIsland'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  pumpIslandId: z.string().min(1, 'Selecciona una isla'),
  tankId: z.string().min(1, 'Selecciona un tanque'),
  isOperational: z.string(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

interface Tank { id: string; name: string; fuelType: { name: string } }

export default function EditDispenserPage() {
  const { id: stationId, dispenserId } = useParams<{ id: string; dispenserId: string }>()
  const searchParams = useSearchParams()
  const expandIsland = searchParams.get('expandIsland') ?? ''
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment${expandIsland ? `?expandIsland=${expandIsland}` : ''}`

  const { data, loading: fetching } = useQuery<{ dispenser: any }>(
    QUERIES.dispenser, { variables: { id: dispenserId }, skip: !dispenserId }
  )
  const { data: islandsData } = useQuery<{ pumpIslandsByGasStation: { id: string; name: string }[] }>(
    ISLAND_QUERIES.pumpIslandsByGasStation, { variables: { gasStationId: stationId } }
  )
  const { data: tanksData } = useQuery<{ tanksByGasStation: Tank[] }>(
    TANK_QUERIES.tanksByGasStation, { variables: { gasStationId: stationId } }
  )
  const [update, { loading }] = useMutation(MUTATIONS.updateDispenser, {
    refetchQueries: [{ query: QUERIES.dispensersByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data?.dispenser) {
      const d = data.dispenser
      reset({ name: d.name, pumpIslandId: d.pumpIslandId, tankId: d.tankId, isOperational: String(d.isOperational) })
    }
  }, [data, reset])

  const selectedTankId = watch('tankId')
  const selectedTank = tanksData?.tanksByGasStation.find((t) => t.id === selectedTankId)

  const onSubmit = async (data: FormData) => {
    try {
      await update({
        variables: {
          id: dispenserId,
          input: {
            name: data.name,
            pumpIslandId: data.pumpIslandId,
            tankId: data.tankId,
            isOperational: data.isOperational === 'true',
          },
        },
      })
      toast.success('Dispensador actualizado.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al actualizar.') }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6">
      <PageHeader title="Editar dispensador" description={data?.dispenser?.name ?? ''} />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos del dispensador</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Isla *</Label>
              <select {...register('pumpIslandId')} className={selectClass}>
                <option value="">Seleccionar isla...</option>
                {islandsData?.pumpIslandsByGasStation.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Tanque *</Label>
              <select {...register('tankId')} className={selectClass}>
                <option value="">Seleccionar tanque...</option>
                {tanksData?.tanksByGasStation.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.fuelType.name}</option>
                ))}
              </select>
            </div>

            {selectedTank && (
              <div className="space-y-1.5">
                <Label>Combustible (derivado del tanque)</Label>
                <div className={cn(selectClass, 'flex items-center bg-muted/30 text-muted-foreground cursor-default')}>
                  {selectedTank.fuelType.name}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <select {...register('isOperational')} className={selectClass}>
                <option value="true">Operativo</option>
                <option value="false">Inactivo</option>
              </select>
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
