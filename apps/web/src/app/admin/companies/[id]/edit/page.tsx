'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/company'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Company {
  id: string
  name: string
  address: string | null
  phone: string | null
  logo: string | null
  createdAt: string
}

const companySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
})

type CompanyFormData = z.infer<typeof companySchema>

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ company: Company | null }>(QUERIES.company, {
    variables: { id },
    skip: !id,
  })

  const [updateCompany, { loading: saving }] = useMutation(MUTATIONS.updateCompany, {
    refetchQueries: [{ query: QUERIES.companies }],
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyFormData>({ resolver: zodResolver(companySchema) })

  useEffect(() => {
    if (data?.company) {
      reset({
        name: data.company.name,
        address: data.company.address ?? '',
        phone: data.company.phone ?? '',
        logo: data.company.logo ?? '',
      })
    }
  }, [data, reset])

  const onSubmit = async (formData: CompanyFormData) => {
    try {
      await updateCompany({
        variables: {
          id,
          input: {
            name: formData.name,
            address: formData.address || null,
            phone: formData.phone || null,
            logo: formData.logo || null,
          },
        },
      })
      toast.success('Empresa actualizada correctamente.')
      router.push('/admin/companies')
    } catch {
      toast.error('No se pudo actualizar la empresa.')
    }
  }

  if (fetching) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
        title="Editar empresa"
        description={data?.company?.name}
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
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register('address')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register('phone')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo">URL del logo</Label>
              <Input id="logo" aria-invalid={!!errors.logo} {...register('logo')} />
              {errors.logo && <p className="text-xs text-destructive">{errors.logo.message}</p>}
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
