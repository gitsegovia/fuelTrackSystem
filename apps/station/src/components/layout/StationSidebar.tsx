import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { navItems, useStationNav } from './useStationNav'

export function StationSidebar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { unsynced, pendingCount, failedCount, handleLogout, logoutDialog } = useStationNav()

  return (
    <aside className="hidden md:flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0">
      <div className="h-[3px] shrink-0" style={{ background: 'var(--brand-gradient)' }} />
      {/* Logo */}
      <div className="px-5 py-5">
        <BrandLogo
          tone="dark"
          symbolClassName="size-11"
          textClassName="text-lg"
          subtitle={user?.assignedGasStation?.name}
          subtitleClassName="text-[11px] text-sidebar-foreground/50"
        />
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
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ background: 'var(--brand-gradient)' }}
                />
              )}
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

      {logoutDialog}
    </aside>
  )
}
