'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/company'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const companySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
})

type CompanyFormData = z.infer<typeof companySchema>

export default function NewCompanyPage() {
  const router = useRouter()
  const [createCompany, { loading }] = useMutation(MUTATIONS.createCompany, {
    refetchQueries: [{ query: QUERIES.companies }],
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormData>({ resolver: zodResolver(companySchema) })

  const onSubmit = async (data: CompanyFormData) => {
    try {
      await createCompany({
        variables: {
          input: {
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
            logo: data.logo || null,
          },
        },
      })
      toast.success('Empresa creada correctamente.')
      router.push('/admin/companies')
    } catch {
      toast.error('No se pudo crear la empresa.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nueva empresa"
        description="Registra una nueva empresa en el sistema"
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
                placeholder="Nombre de la empresa"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" placeholder="Dirección física" {...register('address')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" placeholder="+58 212 000 0000" {...register('phone')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo">URL del logo</Label>
              <Input
                id="logo"
                placeholder="https://example.com/logo.png"
                aria-invalid={!!errors.logo}
                {...register('logo')}
              />
              {errors.logo && <p className="text-xs text-destructive">{errors.logo.message}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear empresa'}
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
