'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@apollo/client/react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/pumpIsland'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function EditPumpIslandPage() {
  const { id: stationId, islandId } = useParams<{ id: string; islandId: string }>()
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment?expandIsland=${islandId}`

  const { data, loading: fetching } = useQuery<{ pumpIsland: any }>(QUERIES.pumpIsland, { variables: { id: islandId }, skip: !islandId })
  const [update, { loading }] = useMutation(MUTATIONS.updatePumpIsland, {
    refetchQueries: [{ query: QUERIES.pumpIslandsByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.pumpIsland) reset({ name: data.pumpIsland.name, description: data.pumpIsland.description ?? '' })
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({ variables: { id: islandId, input: { name: data.name, description: data.description || undefined } } })
      toast.success('Isla actualizada.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al actualizar.') }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6">
      <PageHeader title="Editar isla" description={data?.pumpIsland?.name ?? ''} />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos de la isla</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" {...register('description')} />
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
