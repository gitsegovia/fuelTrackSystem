'use client'

import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Mi perfil" description="Datos de tu cuenta en el panel admin." />

      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Usuario" value={user.username} />
          <Field label="Rol" value={user.role} />
          <Field label="Tipo / cargo" value={user.userType} />
          <Field label="Empresa" value={user.company.name} />
          <Field label="Estación asignada" value={user.assignedGasStation?.name ?? '—'} />
          {user.employeeProfile && (
            <>
              <Field
                label="Nombre"
                value={`${user.employeeProfile.firstName} ${user.employeeProfile.lastName}`}
              />
              <Field label="Posición" value={user.employeeProfile.position} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
