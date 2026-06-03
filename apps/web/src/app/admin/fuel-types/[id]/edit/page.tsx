'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/fuelType'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface FuelType {
  id: string
  name: string
  costPerLiter: string
  createdAt: string
}

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  costPerLiter: z
    .string()
    .min(1, 'El costo es requerido')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser un número mayor a 0'),
})

type FormData = z.infer<typeof schema>

export default function EditFuelTypePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ fuelType: FuelType | null }>(QUERIES.fuelType, {
    variables: { id },
    skip: !id,
  })

  const [updateFuelType, { loading: saving }] = useMutation(MUTATIONS.updateFuelType, {
    refetchQueries: [{ query: QUERIES.fuelTypes }],
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.fuelType) {
      reset({
        name: data.fuelType.name,
        costPerLiter: data.fuelType.costPerLiter,
      })
    }
  }, [data, reset])

  const onSubmit = async (formData: FormData) => {
    try {
      await updateFuelType({
        variables: {
          id,
          input: {
            name: formData.name,
            costPerLiter: formData.costPerLiter,
          },
        },
      })
      toast.success('Tipo de combustible actualizado correctamente.')
      router.push('/admin/fuel-types')
    } catch {
      toast.error('No se pudo actualizar el tipo de combustible.')
    }
  }

  if (fetching) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Editar tipo de combustible"
        description={data?.fuelType?.name}
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
              <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="costPerLiter">Costo por litro *</Label>
              <Input
                id="costPerLiter"
                type="number"
                step="0.0001"
                aria-invalid={!!errors.costPerLiter}
                {...register('costPerLiter')}
              />
              {errors.costPerLiter && (
                <p className="text-xs text-destructive">{errors.costPerLiter.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
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
