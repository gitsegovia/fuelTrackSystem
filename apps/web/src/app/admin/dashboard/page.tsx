'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { Building2, Fuel, Users, Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { QUERIES as CompanyQueries } from '@/services/graphql/gql/company'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { QUERIES as UserQueries } from '@/services/graphql/gql/user'
import { QUERIES as FuelTypeQueries } from '@/services/graphql/gql/fuelType'
import { cn } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

const TICKET_FIELDS = `
  id status ticketIssueTime requestedLiters actualLitersDispatched totalAmountExpected
  fuelType { id name }
  assignedSaleTypeConfig { currency { id symbol exchangeRate } }
`

const DASHBOARD_TICKETS = gql`
  query DashboardTickets($gasStationId: UUID!) {
    salesTicketsByGasStation(gasStationId: $gasStationId) { ${TICKET_FIELDS} }
  }
`

const DASHBOARD_ALL_TICKETS = gql`
  query DashboardAllTickets {
    salesTickets { ${TICKET_FIELDS} }
  }
`

const CHART_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F97316']

const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
]

const selectClass = cn(
  'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
)

function StatCard({
  title, value, unit, icon: Icon, trend, loading,
}: {
  title: string; value: number; unit?: string; icon: any
  trend?: { value: number; label: string }; loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : (
          <>
            <div className="text-2xl font-bold">
              {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
            </div>
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs mt-1',
                trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {trend.value > 0 ? <TrendingUp className="size-3" />
                  : trend.value < 0 ? <TrendingDown className="size-3" />
                  : <Minus className="size-3" />}
                <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% vs período anterior</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const [rangeDays, setRangeDays] = useState(30)

  const { data: companies, loading: l1 } = useQuery<{ companies: { id: string }[] }>(CompanyQueries.companies)
  const { data: stations, loading: l2 } = useQuery<{ gasStations: { id: string; name: string }[] }>(GasStationQueries.gasStations)
  const { data: users, loading: l3 } = useQuery<{ users: { id: string }[] }>(UserQueries.users)
  const { data: fuelTypes, loading: l4 } = useQuery<{ fuelTypes: { id: string }[] }>(FuelTypeQueries.fuelTypes)

  const showAll = selectedStationId === ''

  const { data: stationTicketsData, loading: loadingStation } = useQuery<{ salesTicketsByGasStation: any[] }>(DASHBOARD_TICKETS, {
    variables: { gasStationId: selectedStationId },
    skip: showAll || !selectedStationId,
  })
  const { data: allTicketsData, loading: loadingAll } = useQuery<{ salesTickets: any[] }>(DASHBOARD_ALL_TICKETS, {
    skip: !showAll,
  })

  const loadingTickets = showAll ? loadingAll : loadingStation
  const allTickets: any[] = showAll
    ? (allTicketsData?.salesTickets ?? [])
    : (stationTicketsData?.salesTicketsByGasStation ?? [])

  // Rango de fechas actual y anterior
  const now = new Date()
  const periodStart = startOfDay(subDays(now, rangeDays))
  const prevPeriodStart = startOfDay(subDays(now, rangeDays * 2))

  const currentPeriodTickets = allTickets.filter((t) => {
    const d = new Date(t.ticketIssueTime)
    return d >= periodStart && d <= endOfDay(now)
  })
  const prevPeriodTickets = allTickets.filter((t) => {
    const d = new Date(t.ticketIssueTime)
    return d >= prevPeriodStart && d < periodStart
  })

  const completedCurrent = currentPeriodTickets.filter((t) => t.status === 'COMPLETED')
  const completedPrev    = prevPeriodTickets.filter((t) => t.status === 'COMPLETED')

  const liters = (list: any[]) => list.reduce((s, t) => s + parseFloat(t.actualLitersDispatched ?? t.requestedLiters ?? '0'), 0)
  const baseRevenue = (list: any[]) => list.reduce((s, t) => {
    const rate = parseFloat(t.assignedSaleTypeConfig?.currency?.exchangeRate ?? '1')
    return s + parseFloat(t.totalAmountExpected ?? '0') / rate
  }, 0)

  const currentLiters  = liters(completedCurrent)
  const prevLiters     = liters(completedPrev)
  const currentRevenue = baseRevenue(completedCurrent)
  const prevRevenue    = baseRevenue(completedPrev)

  const litersTrend  = prevLiters  > 0 ? ((currentLiters  - prevLiters)  / prevLiters)  * 100 : 0
  const revenueTrend = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0
  const ticketsTrend = completedPrev.length > 0
    ? ((completedCurrent.length - completedPrev.length) / completedPrev.length) * 100 : 0

  // ── BarChart: litros por día ─────────────────────────────────────────────
  const fuelNames = useMemo(() => {
    const names = new Set<string>()
    completedCurrent.forEach((t) => names.add(t.fuelType.name))
    return [...names]
  }, [completedCurrent])

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: periodStart, end: now })
    return days.map((day) => {
      const dayStr = format(day, 'dd/MM', { locale: es })
      const dayTickets = completedCurrent.filter(
        (t) => format(new Date(t.ticketIssueTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      )
      const row: Record<string, any> = { date: dayStr }
      fuelNames.forEach((name) => {
        row[name] = dayTickets
          .filter((t) => t.fuelType.name === name)
          .reduce((s, t) => s + parseFloat(t.actualLitersDispatched ?? t.requestedLiters ?? '0'), 0)
      })
      return row
    })
  }, [completedCurrent, fuelNames, periodStart, now])

  // ── Donut: distribución por combustible ─────────────────────────────────
  const fuelDistribution = useMemo(() => {
    const map: Record<string, number> = {}
    completedCurrent.forEach((t) => {
      const name = t.fuelType.name
      const l = parseFloat(t.actualLitersDispatched ?? t.requestedLiters ?? '0')
      map[name] = (map[name] ?? 0) + l
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [completedCurrent])

  // ── LineChart: tendencia diaria de tickets ───────────────────────────────
  const ticketTrendData = useMemo(() => {
    const days = eachDayOfInterval({ start: periodStart, end: now })
    return days.map((day) => ({
      date: format(day, 'dd/MM'),
      tickets: currentPeriodTickets.filter(
        (t) => format(new Date(t.ticketIssueTime), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      ).length,
    }))
  }, [currentPeriodTickets, periodStart, now])

  const currencySymbol = allTickets[0]?.assignedSaleTypeConfig?.currency?.symbol ?? '$'

  const systemStats = [
    { title: 'Empresas',     value: l1 ? 0 : companies?.companies?.length ?? 0,  icon: Building2, loading: l1 },
    { title: 'Estaciones',   value: l2 ? 0 : stations?.gasStations?.length ?? 0,  icon: Fuel,      loading: l2 },
    { title: 'Usuarios',     value: l3 ? 0 : users?.users?.length ?? 0,           icon: Users,     loading: l3 },
    { title: 'Combustibles', value: l4 ? 0 : fuelTypes?.fuelTypes?.length ?? 0,   icon: Droplets,  loading: l4 },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Resumen operacional de FuelTrack" />

      {/* Stats del sistema */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {systemStats.map((s) => (
          <StatCard key={s.title} {...s} trend={undefined} />
        ))}
      </div>

      {/* Controles: estación + rango */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
          value={selectedStationId}
          onChange={(e) => setSelectedStationId(e.target.value)}
        >
          <option value="">Todas las estaciones</option>
          {stations?.gasStations?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex rounded-lg border overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                rangeDays === r.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs del período */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title="Tickets completados"
          value={completedCurrent.length}
          icon={Fuel}
          trend={{ value: ticketsTrend, label: '' }}
          loading={loadingTickets}
        />
        <StatCard
          title="Litros despachados"
          value={currentLiters}
          unit="L"
          icon={Droplets}
          trend={{ value: litersTrend, label: '' }}
          loading={loadingTickets}
        />
        <StatCard
          title="Recaudación (base)"
          value={currentRevenue}
          unit={currencySymbol}
          icon={TrendingUp}
          trend={{ value: revenueTrend, label: '' }}
          loading={loadingTickets}
        />
      </div>

      {loadingTickets ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 col-span-2" />
          <Skeleton className="h-72" />
        </div>
      ) : completedCurrent.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Sin datos de ventas en los últimos {rangeDays} días para esta estación.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Fila 1: BarChart + Donut */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Litros por día */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Litros despachados por día
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      interval={rangeDays > 14 ? Math.floor(rangeDays / 7) - 1 : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : v}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} L`]}
                    />
                    {fuelNames.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {fuelNames.map((name, i) => (
                      <Bar key={name} dataKey={name} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === fuelNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Donut: por combustible */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Por combustible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={fuelDistribution}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {fuelDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} L`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 -mt-2">
                  {fuelDistribution.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">
                        {currentLiters > 0 ? ((item.value / currentLiters) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fila 2: LineChart de tickets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Tickets por día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={ticketTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval={rangeDays > 14 ? Math.floor(rangeDays / 7) - 1 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [v, 'Tickets']}
                  />
                  <Line
                    type="monotone"
                    dataKey="tickets"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#F59E0B' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
