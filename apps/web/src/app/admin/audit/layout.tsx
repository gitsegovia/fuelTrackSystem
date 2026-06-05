'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { useAuth } from '@/hooks/useAuth'
import { QUERIES as GasStationQueries } from '@/services/graphql/gql/gasStation'
import { cn } from '@/lib/utils'
import { Truck, Timer, User, Layers, Wallet, Archive } from 'lucide-react'
import { Label } from '@/components/ui/label'

const tabs = [
  { href: '/admin/audit/recepciones', label: 'Recepciones', icon: Truck },
  { href: '/admin/audit/turnos', label: 'Turnos', icon: Timer },
  { href: '/admin/audit/bomberos', label: 'Bomberos', icon: User },
  { href: '/admin/audit/tanques', label: 'Tanques', icon: Layers },
  { href: '/admin/audit/financiero', label: 'Financiero', icon: Wallet },
  { href: '/admin/audit/cierres', label: 'Cierres', icon: Archive },
]

const selectClass = cn(
  'h-8 min-w-[180px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const { data } = useQuery<{ gasStations: { id: string; name: string; code: string; company: { id: string } }[] }>(
    GasStationQueries.gasStations
  )

  const stations = (data?.gasStations ?? []).filter(
    (s) => !user?.company?.id || s.company.id === user.company.id
  )

  const selectedId = searchParams.get('stationId') ?? stations[0]?.id ?? ''

  function onStationChange(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('stationId', id)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function buildTabHref(href: string) {
    const params = new URLSearchParams()
    if (selectedId) params.set('stationId', selectedId)
    const qs = params.toString()
    return qs ? `${href}?${qs}` : href
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Auditoría y Análisis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control operacional: diferenciales de inventario, rendimiento por turno y cuadres financieros
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Label className="text-xs text-muted-foreground mb-1.5">Estación</Label>
          <select
            value={selectedId}
            onChange={(e) => onStationChange(e.target.value)}
            className={selectClass}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-border pb-0">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={buildTabHref(href)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}
