'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/currency'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  symbol: z.string().min(1, 'El símbolo es requerido'),
  exchangeRate: z.string()
    .min(1, 'La tasa es requerida')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser un número positivo'),
})
type FormData = z.infer<typeof schema>

export default function NewCurrencyPage() {
  const router = useRouter()
  const [create, { loading }] = useMutation(MUTATIONS.createCurrency, {
    refetchQueries: [{ query: QUERIES.currencies }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create({ variables: { input: { name: data.name, symbol: data.symbol, exchangeRate: data.exchangeRate } } })
      toast.success('Moneda creada correctamente.')
      router.push('/admin/currencies')
    } catch {
      toast.error('No se pudo crear la moneda.')
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Nueva moneda"
        description="Registra una moneda y su tasa de cambio"
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
              <Input id="name" placeholder="Ej: Dólar estadounidense" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Símbolo *</Label>
              <Input id="symbol" placeholder="Ej: $" {...register('symbol')} aria-invalid={!!errors.symbol} />
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exchangeRate">Tasa de cambio *</Label>
              <Input id="exchangeRate" placeholder="1.00" {...register('exchangeRate')} aria-invalid={!!errors.exchangeRate} />
              {errors.exchangeRate && <p className="text-xs text-destructive">{errors.exchangeRate.message}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear moneda'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
