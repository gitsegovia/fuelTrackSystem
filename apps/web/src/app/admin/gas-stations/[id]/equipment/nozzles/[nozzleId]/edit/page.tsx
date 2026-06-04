'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@apollo/client/react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/dispenserNozzle'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  initialMeterReading: z.string().min(1, 'Requerido').refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Debe ser ≥ 0'),
  currentMeterReading: z.string().min(1, 'Requerido').refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Debe ser ≥ 0'),
  isOperational: z.string(),
})
type FormData = z.infer<typeof schema>

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
)

export default function EditNozzlePage() {
  const { id: stationId, nozzleId } = useParams<{ id: string; nozzleId: string }>()
  const searchParams = useSearchParams()
  const expandIsland = searchParams.get('expandIsland') ?? ''
  const router = useRouter()
  const back = `/admin/gas-stations/${stationId}/equipment${expandIsland ? `?expandIsland=${expandIsland}` : ''}`

  const { data, loading: fetching } = useQuery<{ dispenserNozzle: any }>(
    QUERIES.dispenserNozzle, { variables: { id: nozzleId }, skip: !nozzleId }
  )
  const [update, { loading }] = useMutation(MUTATIONS.updateDispenserNozzle, {
    refetchQueries: data?.dispenserNozzle?.dispenserId
      ? [{ query: QUERIES.dispenserNozzlesByDispenser, variables: { dispenserId: data.dispenserNozzle.dispenserId } }]
      : [],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.dispenserNozzle) {
      const n = data.dispenserNozzle
      reset({
        name: n.name,
        initialMeterReading: String(n.initialMeterReading),
        currentMeterReading: String(n.currentMeterReading),
        isOperational: String(n.isOperational),
      })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({
        variables: {
          id: nozzleId,
          input: {
            name: data.name,
            initialMeterReading: data.initialMeterReading,
            currentMeterReading: data.currentMeterReading,
            isOperational: data.isOperational === 'true',
          },
        },
      })
      toast.success('Boquilla actualizada.')
      router.push(back)
    } catch (err: any) { toast.error(err.message ?? 'Error al actualizar.') }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6">
      <PageHeader title="Editar boquilla" description={data?.dispenserNozzle?.name ?? ''} />
      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Datos de la boquilla</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lectura inicial *</Label>
                <Input {...register('initialMeterReading')} aria-invalid={!!errors.initialMeterReading} />
                {errors.initialMeterReading && <p className="text-xs text-destructive">{errors.initialMeterReading.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Lectura actual *</Label>
                <Input {...register('currentMeterReading')} aria-invalid={!!errors.currentMeterReading} />
                {errors.currentMeterReading && <p className="text-xs text-destructive">{errors.currentMeterReading.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <select {...register('isOperational')} className={selectClass}>
                <option value="true">Operativa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(back)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
