'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation, useQuery } from '@apollo/client/react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/dispenser'
import { QUERIES as TANK_QUERIES } from '@/services/graphql/gql/tank'
import { QUERIES as ISLAND_QUERIES } from '@/services/graphql/gql/pumpIsland'
import { QUERIES as FT_QUERIES } from '@/services/graphql/gql/fuelType'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  pumpIslandId: z.string().min(1, 'Selecciona una isla'),
  tankId: z.string().min(1, 'Selecciona un tanque'),
  fuelTypeId: z.string().min(1, 'Selecciona un combustible'),
  isOperational: z.string(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

export default function NewDispenserPage() {
  const { id: stationId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const defaultIslandId = searchParams.get('pumpIslandId') ?? ''
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment`

  const { data: islandsData } = useQuery<{ pumpIslandsByGasStation: { id: string; name: string }[] }>(
    ISLAND_QUERIES.pumpIslandsByGasStation, { variables: { gasStationId: stationId } }
  )
  const { data: tanksData } = useQuery<{ tanksByGasStation: { id: string; name: string; fuelType: { name: string } }[] }>(
    TANK_QUERIES.tanksByGasStation, { variables: { gasStationId: stationId } }
  )
  const { data: ftData } = useQuery<{ fuelTypes: { id: string; name: string }[] }>(FT_QUERIES.fuelTypes)

  const [create, { loading }] = useMutation(MUTATIONS.createDispenser, {
    refetchQueries: [{ query: QUERIES.dispensersByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { pumpIslandId: defaultIslandId, isOperational: 'true' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create({
        variables: {
          input: {
            gasStationId: stationId,
            pumpIslandId: data.pumpIslandId,
            tankId: data.tankId,
            fuelTypeId: data.fuelTypeId,
            name: data.name,
            isOperational: data.isOperational === 'true',
          },
        },
      })
      toast.success('Dispensador creado correctamente.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al crear.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo dispensador" description="Añade un dispensador a la isla" />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos del dispensador</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" placeholder="Ej: Dispensador 1" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pumpIslandId">Isla *</Label>
              <select id="pumpIslandId" {...register('pumpIslandId')} className={selectClass}>
                <option value="">Seleccionar isla...</option>
                {islandsData?.pumpIslandsByGasStation.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              {errors.pumpIslandId && <p className="text-xs text-destructive">{errors.pumpIslandId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankId">Tanque *</Label>
              <select id="tankId" {...register('tankId')} className={selectClass}>
                <option value="">Seleccionar tanque...</option>
                {tanksData?.tanksByGasStation.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.fuelType.name})</option>
                ))}
              </select>
              {errors.tankId && <p className="text-xs text-destructive">{errors.tankId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuelTypeId">Tipo de combustible *</Label>
              <select id="fuelTypeId" {...register('fuelTypeId')} className={selectClass}>
                <option value="">Seleccionar combustible...</option>
                {ftData?.fuelTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>{ft.name}</option>
                ))}
              </select>
              {errors.fuelTypeId && <p className="text-xs text-destructive">{errors.fuelTypeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isOperational">Estado</Label>
              <select id="isOperational" {...register('isOperational')} className={selectClass}>
                <option value="true">Operativo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Crear dispensador'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
