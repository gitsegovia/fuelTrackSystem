'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation } from '@apollo/client/react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/pumpIsland'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function NewPumpIslandPage() {
  const { id: stationId } = useParams<{ id: string }>()
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment`

  const [create, { loading }] = useMutation<{ createPumpIsland: { id: string } }>(MUTATIONS.createPumpIsland, {
    refetchQueries: [{ query: QUERIES.pumpIslandsByGasStation, variables: { gasStationId: stationId } }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const result = await create({ variables: { input: { gasStationId: stationId, name: data.name, description: data.description || undefined } } })
      toast.success('Isla creada correctamente.')
      const createdId = result.data?.createPumpIsland?.id
      router.push(createdId ? `${back}?expandIsland=${createdId}` : back)
    } catch (err: any) { toast.error(err.message ?? 'Error al crear.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nueva isla de bombeo" description="Añade una isla a la estación" />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos de la isla</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" placeholder="Ej: Isla 1" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" placeholder="Ej: Isla central con 2 dispensadores" {...register('description')} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Crear isla'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
