'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@apollo/client/react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/tankModel'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const optionalDecimal = z.string().refine(
  (v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
  'Debe ser un número válido'
).optional()

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  nominalCapacity: z.string().min(1, 'Requerido').refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser mayor a 0'
  ),
  shape: z.string().min(1, 'La forma es requerida'),
  lengthCm: optionalDecimal,
  diameterCm: optionalDecimal,
  widthCm: optionalDecimal,
  heightCm: optionalDecimal,
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const SHAPES = ['Cylindrical Horizontal', 'Cylindrical Vertical', 'Rectangular', 'Square']

export default function EditTankModelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ tankModel: any }>(QUERIES.tankModel, {
    variables: { id },
    skip: !id,
  })

  const [updateTankModel, { loading }] = useMutation(MUTATIONS.updateTankModel, {
    refetchQueries: [{ query: QUERIES.tankModels }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data?.tankModel) {
      const m = data.tankModel
      reset({
        name: m.name,
        nominalCapacity: String(m.nominalCapacity),
        shape: m.shape,
        lengthCm: m.lengthCm ? String(m.lengthCm) : '',
        diameterCm: m.diameterCm ? String(m.diameterCm) : '',
        widthCm: m.widthCm ? String(m.widthCm) : '',
        heightCm: m.heightCm ? String(m.heightCm) : '',
        description: m.description ?? '',
      })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await updateTankModel({
        variables: {
          id,
          input: {
            name: data.name,
            nominalCapacity: data.nominalCapacity,
            shape: data.shape,
            lengthCm: data.lengthCm || undefined,
            diameterCm: data.diameterCm || undefined,
            widthCm: data.widthCm || undefined,
            heightCm: data.heightCm || undefined,
            description: data.description || undefined,
          },
        },
      })
      toast.success('Modelo actualizado correctamente.')
      router.push('/admin/tank-models')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar.')
    }
  }

  if (fetching) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full max-w-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Editar modelo de tanque" description={data?.tankModel?.name ?? ''} />

      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Datos del modelo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nominalCapacity">Capacidad nominal (L) *</Label>
                <Input id="nominalCapacity" {...register('nominalCapacity')} aria-invalid={!!errors.nominalCapacity} />
                {errors.nominalCapacity && <p className="text-xs text-destructive">{errors.nominalCapacity.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shape">Forma *</Label>
                <select id="shape" {...register('shape')} className={selectClass}>
                  <option value="">Seleccionar forma...</option>
                  {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.shape && <p className="text-xs text-destructive">{errors.shape.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lengthCm">Largo (cm)</Label>
                <Input id="lengthCm" {...register('lengthCm')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="diameterCm">Diámetro (cm)</Label>
                <Input id="diameterCm" {...register('diameterCm')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="widthCm">Ancho (cm)</Label>
                <Input id="widthCm" {...register('widthCm')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heightCm">Alto (cm)</Label>
                <Input id="heightCm" {...register('heightCm')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" {...register('description')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/admin/tank-models')}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
