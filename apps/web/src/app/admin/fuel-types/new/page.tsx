'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/fuelType'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  costPerLiter: z
    .string()
    .min(1, 'El costo es requerido')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser un número mayor a 0'),
})

type FormData = z.infer<typeof schema>

export default function NewFuelTypePage() {
  const router = useRouter()
  const [createFuelType, { loading }] = useMutation(MUTATIONS.createFuelType, {
    refetchQueries: [{ query: QUERIES.fuelTypes }],
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await createFuelType({
        variables: {
          input: {
            name: data.name,
            costPerLiter: data.costPerLiter,
          },
        },
      })
      toast.success('Tipo de combustible creado correctamente.')
      router.push('/admin/fuel-types')
    } catch {
      toast.error('No se pudo crear el tipo de combustible.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nuevo tipo de combustible"
        description="Registra un nuevo tipo de combustible"
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Volver
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Gasolina 91"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="costPerLiter">Costo por litro *</Label>
              <Input
                id="costPerLiter"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                aria-invalid={!!errors.costPerLiter}
                {...register('costPerLiter')}
              />
              {errors.costPerLiter && (
                <p className="text-xs text-destructive">{errors.costPerLiter.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear tipo'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
