import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Fuel, Users, TrendingUp } from 'lucide-react'

const stats = [
  { title: 'Empresas', value: '—', icon: Building2, description: 'Empresas registradas' },
  { title: 'Estaciones', value: '—', icon: Fuel, description: 'Estaciones activas' },
  { title: 'Usuarios', value: '—', icon: Users, description: 'Usuarios del sistema' },
  { title: 'Ventas hoy', value: '—', icon: TrendingUp, description: 'Tickets procesados' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen general del sistema FuelTrack"
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Los reportes y gráficos estarán disponibles próximamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
