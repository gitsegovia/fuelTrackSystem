'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@apollo/client/react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/employeeShift'
import { QUERIES as EmployeeQueries } from '@/services/graphql/gql/employee'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const schema = z.object({
  employeeRole: z.enum(['CASHIER', 'DISPATCHER', 'SUPERVISOR', 'MANAGER', 'ACCOUNTANT', 'ADMIN']),
})
type FormData = z.infer<typeof schema>

const ROLE_LABELS: Record<string, string> = {
  CASHIER: 'Cajero',
  DISPATCHER: 'Bombero',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Gerente',
  ACCOUNTANT: 'Contador',
  ADMIN: 'Administrador',
}

export default function NewShiftPage() {
  const router = useRouter()
  const { user } = useAuth()
  const gasStationId = user?.assignedGasStation?.id ?? ''

  const { data: empData } = useQuery<{ employees: any[] }>(EmployeeQueries.employees)
  const employee = empData?.employees?.find((e) => e.user.id === user?.id)

  const [create, { loading }] = useMutation(MUTATIONS.createEmployeeShift, {
    refetchQueries: [
      { query: QUERIES.employeeShiftsByGasStation, variables: { gasStationId } },
      { query: QUERIES.activeEmployeeShift, variables: { employeeId: employee?.id } },
    ],
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { employeeRole: 'CASHIER' },
  })

  const onSubmit = async (data: FormData) => {
    if (!employee) {
      toast.error('No se encontró tu perfil de empleado.')
      return
    }
    try {
      const result = await create({
        variables: {
          input: {
            employeeId: employee.id,
            gasStationId,
            shiftStartTime: new Date().toISOString(),
            employeeRole: data.employeeRole,
          },
        },
      })
      toast.success('Turno iniciado.')
      router.push(`/station/shifts/${result.data.createEmployeeShift.id}`)
    } catch (err: any) {
      toast.error(`No se pudo iniciar el turno: ${err.message ?? ''}`)
    }
  }

  return (
    <div className="space-y-6 max-w-sm">
      <PageHeader
        title="Iniciar turno"
        description="Registra el inicio de tu turno de trabajo"
        action={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      {!employee && (
        <p className="text-sm text-destructive">
          Tu usuario no tiene un perfil de empleado asignado. Contacta al administrador.
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Rol en este turno *</Label>
              <select {...register('employeeRole')} className={selectClass}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.employeeRole && <p className="text-xs text-destructive">{errors.employeeRole.message}</p>}
            </div>

            <div className="rounded-lg bg-muted/30 border px-3 py-2 text-sm text-muted-foreground">
              Hora de inicio: <span className="font-medium text-foreground">{new Date().toLocaleTimeString()}</span>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !employee}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Iniciando...' : 'Iniciar turno'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
