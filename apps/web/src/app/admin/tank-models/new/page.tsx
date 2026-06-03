'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation } from '@apollo/client/react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/tankModel'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const decimalField = (label: string) =>
  z.string().min(1, `${label} es requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    `${label} debe ser mayor a 0`
  )

const optionalDecimal = z.string().refine(
  (v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
  'Debe ser un número válido'
).optional()

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  nominalCapacity: decimalField('La capacidad nominal'),
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

export default function NewTankModelPage() {
  const router = useRouter()
  const [createTankModel, { loading }] = useMutation(MUTATIONS.createTankModel, {
    refetchQueries: [{ query: QUERIES.tankModels }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { shape: '' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await createTankModel({
        variables: {
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
      toast.success('Modelo de tanque creado correctamente.')
      router.push('/admin/tank-models')
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear el modelo.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo modelo de tanque" description="Registra un nuevo modelo en el catálogo" />

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
                <Input id="lengthCm" {...register('lengthCm')} aria-invalid={!!errors.lengthCm} />
                {errors.lengthCm && <p className="text-xs text-destructive">{errors.lengthCm.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="diameterCm">Diámetro (cm)</Label>
                <Input id="diameterCm" {...register('diameterCm')} aria-invalid={!!errors.diameterCm} />
                {errors.diameterCm && <p className="text-xs text-destructive">{errors.diameterCm.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="widthCm">Ancho (cm)</Label>
                <Input id="widthCm" {...register('widthCm')} aria-invalid={!!errors.widthCm} />
                {errors.widthCm && <p className="text-xs text-destructive">{errors.widthCm.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heightCm">Alto (cm)</Label>
                <Input id="heightCm" {...register('heightCm')} aria-invalid={!!errors.heightCm} />
                {errors.heightCm && <p className="text-xs text-destructive">{errors.heightCm.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" {...register('description')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Guardando...' : 'Crear modelo'}
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
