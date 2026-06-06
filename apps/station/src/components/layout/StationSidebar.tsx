import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Clock, Receipt, LogOut, Gauge, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/shifts',     label: 'Turnos',           icon: Clock           },
  { to: '/tickets',    label: 'Tickets de venta', icon: Receipt         },
  { to: '/tanks',      label: 'Tanques',          icon: Droplets        },
]

export function StationSidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Gauge className="size-5 text-primary-foreground" />
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight block">FuelTrack</span>
          {user?.assignedGasStation && (
            <span className="text-[11px] text-sidebar-foreground/50 leading-tight">
              {user.assignedGasStation.name}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
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

      <div className="h-px bg-sidebar-border" />

      {/* User + logout */}
      <div className="px-3 py-4 space-y-2">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground">{user.username}</p>
            <p className="text-xs text-sidebar-foreground/50">{user.userType}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
