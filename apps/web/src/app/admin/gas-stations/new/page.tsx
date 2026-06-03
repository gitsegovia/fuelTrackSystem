'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/gasStation'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  code: z.string().min(1, 'El código es requerido'),
  address: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewGasStationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [createGasStation, { loading }] = useMutation(MUTATIONS.createGasStation, {
    refetchQueries: [{ query: QUERIES.gasStations }],
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await createGasStation({
        variables: {
          input: {
            name: data.name,
            code: data.code,
            address: data.address || null,
            companyId: user?.company.id,
          },
        },
      })
      toast.success('Estación creada correctamente.')
      router.push('/admin/gas-stations')
    } catch {
      toast.error('No se pudo crear la estación.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nueva estación"
        description="Registra una nueva estación de servicio"
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
                placeholder="Estación Central"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                placeholder="EST-001"
                aria-invalid={!!errors.code}
                {...register('code')}
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" placeholder="Dirección física" {...register('address')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !user}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear estación'}
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
