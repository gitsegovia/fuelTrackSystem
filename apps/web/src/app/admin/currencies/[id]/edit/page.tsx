'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/currency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  symbol: z.string().min(1, 'El símbolo es requerido'),
  exchangeRate: z.string()
    .min(1, 'La tasa es requerida')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser un número positivo'),
})
type FormData = z.infer<typeof schema>

export default function EditCurrencyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ currency: any }>(QUERIES.currency, { variables: { id }, skip: !id })
  const [update, { loading }] = useMutation(MUTATIONS.updateCurrency, {
    refetchQueries: [{ query: QUERIES.currencies }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.currency) {
      const c = data.currency
      reset({ name: c.name, symbol: c.symbol, exchangeRate: String(c.exchangeRate) })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({
        variables: {
          id,
          input: {
            name: data.name,
            symbol: data.symbol,
            exchangeRate: parseFloat(data.exchangeRate),
          },
        },
      })
      toast.success('Moneda actualizada correctamente.')
      router.push('/admin/currencies')
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar la moneda.')
    }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Editar moneda"
        description={data?.currency?.name ?? ''}
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Símbolo *</Label>
              <Input id="symbol" {...register('symbol')} aria-invalid={!!errors.symbol} />
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exchangeRate">Tasa de cambio *</Label>
              <Input id="exchangeRate" {...register('exchangeRate')} aria-invalid={!!errors.exchangeRate} />
              {errors.exchangeRate && <p className="text-xs text-destructive">{errors.exchangeRate.message}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
