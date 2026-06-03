'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useMutation } from '@apollo/client/react'
import { MUTATIONS } from '@/services/graphql/gql/dispenserNozzle'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const decimalPositive = (label: string) =>
  z.string().min(1, `${label} es requerido`).refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, `${label} debe ser ≥ 0`
  )

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  initialMeterReading: decimalPositive('Lectura inicial'),
  currentMeterReading: decimalPositive('Lectura actual'),
  isOperational: z.string(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
)

export default function NewNozzlePage() {
  const { id: stationId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const dispenserId = searchParams.get('dispenserId') ?? ''
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment`

  const [create, { loading }] = useMutation(MUTATIONS.createDispenserNozzle)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isOperational: 'true', initialMeterReading: '', currentMeterReading: '' },
  })

  // Mirror initial reading to current when typing initial
  const initialReading = watch('initialMeterReading')

  const onSubmit = async (data: FormData) => {
    try {
      await create({ variables: { input: { dispenserId, name: data.name, initialMeterReading: data.initialMeterReading, currentMeterReading: data.currentMeterReading, isOperational: data.isOperational === 'true' } } })
      toast.success('Boquilla creada correctamente.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al crear.') }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nueva boquilla" description="Añade una boquilla al dispensador" />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos de la boquilla</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" placeholder="Ej: Boquilla A" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="initialMeterReading">Lectura inicial *</Label>
                <Input id="initialMeterReading" placeholder="0.00" {...register('initialMeterReading')} aria-invalid={!!errors.initialMeterReading}
                  onChange={(e) => { register('initialMeterReading').onChange(e); setValue('currentMeterReading', e.target.value) }} />
                {errors.initialMeterReading && <p className="text-xs text-destructive">{errors.initialMeterReading.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currentMeterReading">Lectura actual *</Label>
                <Input id="currentMeterReading" placeholder="0.00" {...register('currentMeterReading')} aria-invalid={!!errors.currentMeterReading} />
                {errors.currentMeterReading && <p className="text-xs text-destructive">{errors.currentMeterReading.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="isOperational">Estado</Label>
              <select id="isOperational" {...register('isOperational')} className={selectClass}>
                <option value="true">Operativa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Crear boquilla'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
