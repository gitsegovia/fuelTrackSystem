'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/employee'
import { QUERIES as UserQueries } from '@/services/graphql/gql/user'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  userId: z.string().min(1, 'Selecciona un usuario'),
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  position: z.string().min(1, 'El cargo es requerido'),
})
type FormData = z.infer<typeof schema>

export default function NewEmployeePage() {
  const router = useRouter()

  const { data: usersData } = useQuery<{ users: { id: string; username: string; role: string }[] }>(UserQueries.users)
  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const [create, { loading }] = useMutation(MUTATIONS.createEmployee, {
    refetchQueries: [{ query: QUERIES.employees }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await create({ variables: { input: data } })
      toast.success('Empleado creado correctamente.')
      router.push('/admin/employees')
    } catch (err: any) {
      toast.error(err.message?.includes('already exists') ? 'Este usuario ya tiene un perfil de empleado.' : 'No se pudo crear el empleado.')
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader
        title="Nuevo empleado"
        description="Crea un perfil de empleado vinculado a un usuario"
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
              <Label>Usuario *</Label>
              <select {...register('userId')} className={selectClass}>
                <option value="">Seleccionar usuario...</option>
                {usersData?.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                ))}
              </select>
              {errors.userId && <p className="text-xs text-destructive">{errors.userId.message}</p>}
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
                <Input placeholder="Ej: José" {...register('firstName')} aria-invalid={!!errors.firstName} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input placeholder="Ej: Rodríguez" {...register('lastName')} aria-invalid={!!errors.lastName} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <Input placeholder="Ej: Pistero, Cajero, Supervisor" {...register('position')} aria-invalid={!!errors.position} />
              {errors.position && <p className="text-xs text-destructive">{errors.position.message}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear empleado'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
