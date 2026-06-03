'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/user'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  username: z.string().min(2, 'El usuario debe tener al menos 2 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  userType: z.enum(['Administrator', 'Supervisor', 'Cashier', 'FuelAttendant', 'Administrative']),
  gasStationId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface GasStation {
  id: string
  name: string
}

export default function NewUserPage() {
  const router = useRouter()
  const { user } = useAuth()

  const { data: stationsData } = useQuery<{ gasStations: GasStation[] }>(
    GasStationQueries.gasStations
  )

  const [createUser, { loading }] = useMutation(MUTATIONS.createUser, {
    refetchQueries: [{ query: QUERIES.users }],
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'EMPLOYEE', userType: 'Administrative' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await createUser({
        variables: {
          input: {
            username: data.username,
            password: data.password,
            role: data.role,
            userType: data.userType,
            companyId: user?.company.id,
            gasStationId: data.gasStationId || null,
          },
        },
      })
      toast.success('Usuario creado correctamente.')
      router.push('/admin/users')
    } catch {
      toast.error('No se pudo crear el usuario.')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nuevo usuario"
        description="Registra un nuevo usuario en el sistema"
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
              <Label htmlFor="username">Usuario *</Label>
              <Input
                id="username"
                placeholder="nombre.apellido"
                aria-invalid={!!errors.username}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role">Rol *</Label>
                <select id="role" className={selectClass} {...register('role')}>
                  <option value="ADMIN">Administrador</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="EMPLOYEE">Empleado</option>
                </select>
                {errors.role && (
                  <p className="text-xs text-destructive">{errors.role.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="userType">Tipo *</Label>
                <select id="userType" className={selectClass} {...register('userType')}>
                  <option value="Administrator">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Cashier">Cajero</option>
                  <option value="FuelAttendant">Pistero</option>
                  <option value="Administrative">Administrativo</option>
                </select>
                {errors.userType && (
                  <p className="text-xs text-destructive">{errors.userType.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gasStationId">Estación asignada</Label>
              <select id="gasStationId" className={selectClass} {...register('gasStationId')}>
                <option value="">Sin asignar</option>
                {stationsData?.gasStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading || !user}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Guardando...' : 'Crear usuario'}
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
