'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Clock, Receipt, LogOut, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { href: '/station/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/station/shifts', label: 'Turnos', icon: Clock },
  { href: '/station/tickets', label: 'Tickets de venta', icon: Receipt },
]

export function StationSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Gauge className="size-5 text-primary-foreground" />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight block">FuelTrack</span>
          {user?.assignedGasStation && (
            <span className="text-[11px] text-sidebar-foreground/50 leading-tight">{user.assignedGasStation.name}</span>
          )}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="px-3 py-4 space-y-2">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground">{user.username}</p>
            <p className="text-xs text-sidebar-foreground/50">{user.userType}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
