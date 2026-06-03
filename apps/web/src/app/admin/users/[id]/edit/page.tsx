'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { QUERIES, MUTATIONS } from '@/services/graphql/gql/user'
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
  'transition-colors outline-none',
  'focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

interface User {
  id: string
  username: string
  role: string
  userType: string
  company: { id: string; name: string }
  assignedGasStation: { id: string; name: string } | null
}

interface GasStation {
  id: string
  name: string
}

const schema = z.object({
  username: z.string().min(2, 'El usuario debe tener al menos 2 caracteres'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .optional()
    .or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  userType: z.enum(['Administrator', 'Supervisor', 'Cashier', 'FuelAttendant', 'Administrative']),
  gasStationId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, loading: fetching } = useQuery<{ user: User | null }>(QUERIES.user, {
    variables: { id },
    skip: !id,
  })

  const { data: stationsData } = useQuery<{ gasStations: GasStation[] }>(
    GasStationQueries.gasStations
  )

  const [updateUser, { loading: saving }] = useMutation(MUTATIONS.updateUser, {
    refetchQueries: [{ query: QUERIES.users }],
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data?.user) {
      reset({
        username: data.user.username,
        password: '',
        role: data.user.role as FormData['role'],
        userType: data.user.userType as FormData['userType'],
        gasStationId: data.user.assignedGasStation?.id ?? '',
      })
    }
  }, [data, reset])

  const onSubmit = async (formData: FormData) => {
    try {
      await updateUser({
        variables: {
          id,
          input: {
            username: formData.username,
            ...(formData.password ? { password: formData.password } : {}),
            role: formData.role,
            userType: formData.userType,
            gasStationId: formData.gasStationId || null,
          },
        },
      })
      toast.success('Usuario actualizado correctamente.')
      router.push('/admin/users')
    } catch {
      toast.error('No se pudo actualizar el usuario.')
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
        title="Editar usuario"
        description={data?.user?.username}
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
              <Input id="username" aria-invalid={!!errors.username} {...register('username')} />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Dejar en blanco para no cambiar"
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
