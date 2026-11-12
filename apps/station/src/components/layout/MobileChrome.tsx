import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { navItems, useStationNav } from './useStationNav'

/** Barra superior compacta (solo debajo de md). */
export function MobileTopBar() {
  const { user } = useAuth()
  const { handleLogout, logoutDialog } = useStationNav()

  return (
    <header className="md:hidden flex shrink-0 items-center gap-2.5 bg-sidebar px-4 py-2 text-sidebar-foreground">
      <BrandLogo
        tone="dark"
        className="min-w-0 flex-1"
        symbolClassName="size-10"
        textClassName="text-base"
        subtitle={`${user?.assignedGasStation?.name ?? ''}${user ? ` · ${user.username}` : ''}`}
        subtitleClassName="text-[11px] text-sidebar-foreground/60"
      />
      <button
        onClick={handleLogout}
        aria-label="Cerrar sesión"
        className="flex size-11 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <LogOut className="size-5" />
      </button>
      {logoutDialog}
    </header>
  )
}

/** Navegación inferior fija (solo debajo de md). */
export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { unsynced, pendingCount, failedCount } = useStationNav()

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {navItems.map(({ to, short, icon: Icon }) => {
        const active = pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            aria-label={short}
            className={cn(
              'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-sidebar-foreground/70',
            )}
          >
            <span className="relative">
              <Icon className="size-5" />
              {to === '/sync' && unsynced > 0 && (
                <span
                  className={cn(
                    'absolute -right-2.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white',
                    failedCount > 0 ? 'bg-destructive' : 'bg-amber-500',
                  )}
                  title={`${pendingCount} pendientes · ${failedCount} con error`}
                >
                  {unsynced}
                </span>
              )}
            </span>
            {short}
          </Link>
        )
      })}
    </nav>
  )
}
