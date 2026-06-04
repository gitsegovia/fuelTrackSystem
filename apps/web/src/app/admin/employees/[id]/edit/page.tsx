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
import { MUTATIONS as UserMutations, QUERIES as UserQueries } from '@/services/graphql/gql/user'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  username: z.string().min(2, 'El usuario debe tener al menos 2 caracteres'),
  password: z.string().refine(
    (v) => v === '' || v.length >= 8,
    'Si cambias la contraseña debe tener al menos 8 caracteres'
  ),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  userType: z.enum(['Administrator', 'Supervisor', 'Cashier', 'FuelAttendant', 'Administrative']),
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  position: z.string().min(1, 'El cargo es requerido'),
})
type FormData = z.infer<typeof schema>

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ employee: any }>(
    QUERIES.employee,
    { variables: { id }, skip: !id }
  )
  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(
    GasStationQueries.gasStations
  )
  const [updateEmployee, { loading: savingEmployee }] = useMutation(MUTATIONS.updateEmployee, {
    refetchQueries: [{ query: QUERIES.employees }],
  })
  const [updateUser, { loading: savingUser }] = useMutation(UserMutations.updateUser, {
    refetchQueries: [{ query: UserQueries.users }],
  })

  const saving = savingEmployee || savingUser

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data?.employee) {
      const e = data.employee
      reset({
        username: e.user.username,
        password: '',
        role: e.user.role,
        userType: e.user.userType,
        gasStationId: e.gasStation.id,
        firstName: e.firstName,
        lastName: e.lastName,
        position: e.position,
      })
    }
  }, [data, reset])

  const onSubmit = async (formData: FormData) => {
    const { username, password, role, userType, gasStationId, firstName, lastName, position } = formData
    const userId = data?.employee?.user?.id

    try {
      const userInput: Record<string, string> = { username, role, userType, gasStationId }
      if (password) userInput.password = password

      await Promise.all([
        updateUser({ variables: { id: userId, input: userInput } }),
        updateEmployee({ variables: { id, input: { gasStationId, firstName, lastName, position } } }),
      ])
      toast.success('Empleado actualizado correctamente.')
      router.push('/admin/employees')
    } catch {
      toast.error('No se pudo actualizar el empleado.')
    }
  }

  if (fetching) return <Skeleton className="h-64 w-full max-w-2xl" />

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Editar empleado"
        description={data?.employee ? `${data.employee.firstName} ${data.employee.lastName}` : ''}
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Cuenta de acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Usuario *</Label>
                <Input
                  aria-invalid={!!errors.username}
                  {...register('username')}
                />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  placeholder="Dejar en blanco para no cambiar"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rol *</Label>
                <select {...register('role')} className={selectClass}>
                  <option value="EMPLOYEE">Empleado</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <select {...register('userType')} className={selectClass}>
                  <option value="FuelAttendant">Bombero</option>
                  <option value="Cashier">Cajero</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Administrator">Administrador</option>
                  <option value="Administrative">Administrativo</option>
                </select>
                {errors.userType && <p className="text-xs text-destructive">{errors.userType.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Datos del empleado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <Input aria-invalid={!!errors.firstName} {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input aria-invalid={!!errors.lastName} {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <Input
                placeholder="Ej: Bombero, Cajero, Supervisor"
                aria-invalid={!!errors.position}
                {...register('position')}
              />
              {errors.position && <p className="text-xs text-destructive">{errors.position.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
