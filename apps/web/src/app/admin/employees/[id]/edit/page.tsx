'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/employee'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  position: z.string().min(1, 'El cargo es requerido'),
})
type FormData = z.infer<typeof schema>

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ employee: any }>(QUERIES.employee, { variables: { id }, skip: !id })
  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const [update, { loading }] = useMutation(MUTATIONS.updateEmployee, {
    refetchQueries: [{ query: QUERIES.employees }],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.employee) {
      const e = data.employee
      reset({ gasStationId: e.gasStation.id, firstName: e.firstName, lastName: e.lastName, position: e.position })
    }
  }, [data, reset])

  const onSubmit = async (data: FormData) => {
    try {
      await update({ variables: { id, input: data } })
      toast.success('Empleado actualizado correctamente.')
      router.push('/admin/employees')
    } catch {
      toast.error('No se pudo actualizar el empleado.')
    }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-lg" />

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Editar empleado"
        description={data?.employee ? `${data.employee.firstName} ${data.employee.lastName}` : ''}
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
              <Label>Usuario</Label>
              <div className="h-8 flex items-center px-2.5 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-input">
                {data?.employee?.user?.username}
              </div>
              <p className="text-xs text-muted-foreground">El usuario vinculado no puede cambiarse.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Estación asignada *</Label>
              <select {...register('gasStationId')} className={selectClass}>
                <option value="">Seleccionar estación...</option>
                {stationsData?.gasStations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.gasStationId && <p className="text-xs text-destructive">{errors.gasStationId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input {...register('firstName')} aria-invalid={!!errors.firstName} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input {...register('lastName')} aria-invalid={!!errors.lastName} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <Input {...register('position')} aria-invalid={!!errors.position} />
              {errors.position && <p className="text-xs text-destructive">{errors.position.message}</p>}
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
