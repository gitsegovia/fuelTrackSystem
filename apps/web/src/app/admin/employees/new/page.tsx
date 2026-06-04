'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/employee'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as UserQueries } from '@/services/graphql/gql/user'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  username: z.string().min(2, 'El usuario debe tener al menos 2 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  userType: z.enum(['Administrator', 'Supervisor', 'Cashier', 'FuelAttendant', 'Administrative']),
  gasStationId: z.string().min(1, 'Selecciona una estación'),
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  position: z.string().min(1, 'El cargo es requerido'),
})
type FormData = z.infer<typeof schema>

export default function NewEmployeePage() {
  const router = useRouter()
  const { user } = useAuth()

  const { data: stationsData } = useQuery<{ gasStations: { id: string; name: string }[] }>(
    GasStationQueries.gasStations
  )
  const [create, { loading }] = useMutation(MUTATIONS.createEmployeeWithUser, {
    refetchQueries: [{ query: QUERIES.employees }, { query: UserQueries.users }],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'EMPLOYEE', userType: 'FuelAttendant' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create({
        variables: {
          input: { ...data, companyId: user?.company.id },
        },
      })
      toast.success('Empleado creado correctamente.')
      router.push('/admin/employees')
    } catch (err: any) {
      const msg = err.message ?? ''
      if (msg.includes('already exists')) {
        toast.error('Ese nombre de usuario ya está en uso.')
      } else {
        toast.error('No se pudo crear el empleado.')
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nuevo empleado"
        description="Crea el perfil y la cuenta de acceso del empleado en un solo paso"
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
                  placeholder="nombre.apellido"
                  aria-invalid={!!errors.username}
                  {...register('username')}
                />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
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
                <Input
                  placeholder="Ej: José"
                  aria-invalid={!!errors.firstName}
                  {...register('firstName')}
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input
                  placeholder="Ej: Rodríguez"
                  aria-invalid={!!errors.lastName}
                  {...register('lastName')}
                />
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
          <Button type="submit" disabled={loading || !user}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? 'Guardando...' : 'Crear empleado'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
