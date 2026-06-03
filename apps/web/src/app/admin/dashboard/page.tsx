'use client'

import { useQuery } from '@apollo/client/react'
import { Building2, Fuel, Users, Droplets } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { QUERIES as CompanyQueries } from '@/services/graphql/gql/company'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as UserQueries } from '@/services/graphql/gql/user'
import { QUERIES as FuelTypeQueries } from '@/services/graphql/gql/fuelType'

export default function DashboardPage() {
  const { data: companies, loading: l1 } = useQuery<{ companies: { id: string }[] }>(CompanyQueries.companies)
  const { data: stations, loading: l2 } = useQuery<{ gasStations: { id: string }[] }>(GasStationQueries.gasStations)
  const { data: users, loading: l3 } = useQuery<{ users: { id: string }[] }>(UserQueries.users)
  const { data: fuelTypes, loading: l4 } = useQuery<{ fuelTypes: { id: string }[] }>(FuelTypeQueries.fuelTypes)

  const stats = [
    {
      title: 'Empresas',
      value: l1 ? null : companies?.companies?.length ?? 0,
      icon: Building2,
      description: 'Empresas registradas',
    },
    {
      title: 'Estaciones',
      value: l2 ? null : stations?.gasStations?.length ?? 0,
      icon: Fuel,
      description: 'Estaciones de servicio',
    },
    {
      title: 'Usuarios',
      value: l3 ? null : users?.users?.length ?? 0,
      icon: Users,
      description: 'Usuarios del sistema',
    },
    {
      title: 'Combustibles',
      value: l4 ? null : fuelTypes?.fuelTypes?.length ?? 0,
      icon: Droplets,
      description: 'Tipos de combustible',
    },
  ]

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
              {stat.value === null ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
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
            Los reportes y gráficos de operaciones estarán disponibles próximamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
