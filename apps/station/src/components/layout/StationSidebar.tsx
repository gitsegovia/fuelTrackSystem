import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Clock, Receipt, LogOut, Gauge, Droplets, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOffline } from '@/context/OfflineContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/shifts',     label: 'Turnos',           icon: Clock           },
  { to: '/tickets',    label: 'Tickets de venta', icon: Receipt         },
  { to: '/tanks',      label: 'Tanques',          icon: Droplets        },
  { to: '/sync',       label: 'Sincronización',   icon: RefreshCw       },
]

export function StationSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { pendingCount, failedCount } = useOffline()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const unsynced = pendingCount + failedCount

  const handleLogout = () => {
    if (unsynced > 0) {
      setConfirmLogout(true)
      return
    }
    logout()
  }

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
              {to === '/sync' && unsynced > 0 && (
                <span
                  className={cn(
                    'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    failedCount > 0 ? 'bg-destructive text-white' : 'bg-amber-500 text-white',
                  )}
                  title={`${pendingCount} pendientes · ${failedCount} con error`}
                >
                  {unsynced}
                </span>
              )}
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
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Hay operaciones sin sincronizar"
        description={
          <div className="space-y-2">
            <p>
              {pendingCount > 0 && `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
              {pendingCount > 0 && failedCount > 0 && ' y '}
              {failedCount > 0 && `${failedCount} con error`} en este dispositivo.
            </p>
            <p>
              No se borran al cerrar sesión: quedan guardadas aquí y se enviarán cuando haya conexión,
              aunque luego ingrese otro usuario. Se registran con los datos de quien las creó.
            </p>
          </div>
        }
        extraAction={{
          label: 'Ver operaciones',
          onClick: () => {
            setConfirmLogout(false)
            navigate('/sync')
          },
        }}
        confirmLabel="Cerrar sesión igualmente"
        destructive
        onConfirm={() => {
          setConfirmLogout(false)
          logout()
        }}
      />
    </aside>
  )
}
