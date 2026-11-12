import { Link, useLocation } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { SideTooltip, TooltipProvider } from '@/components/ui/tooltip'
import { navItems, useStationNav } from './useStationNav'

// El texto se desvanece antes de que el ancho termine de encogerse (aside con overflow-hidden y nowrap).
const labelClass = (collapsed: boolean) =>
  cn('whitespace-nowrap transition-opacity', collapsed ? 'opacity-0 duration-100' : 'opacity-100 duration-200 delay-100')

export function StationSidebar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { unsynced, pendingCount, failedCount, handleLogout, logoutDialog } = useStationNav()
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  return (
    <TooltipProvider delay={150}>
      <aside
        className={cn(
          'hidden md:flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground shrink-0 transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Encabezado */}
        {collapsed ? (
          <div className="flex justify-center py-5">
            <SideTooltip label="Abrir barra lateral">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Abrir barra lateral"
                className="group relative size-11 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="absolute inset-0 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                  <BrandLogo tone="dark" symbolClassName="size-11" showText={false} />
                </span>
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <PanelLeftOpen className="size-5" />
                </span>
              </button>
            </SideTooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-5 py-5">
            <BrandLogo
              tone="dark"
              className="min-w-0 flex-1"
              symbolClassName="size-11"
              textClassName="text-lg"
              subtitle={user?.assignedGasStation?.name}
              subtitleClassName="text-[11px] text-sidebar-foreground/50"
            />
            <SideTooltip label="Ocultar barra lateral" side="bottom">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Ocultar barra lateral"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PanelLeftClose className="size-5" />
              </button>
            </SideTooltip>
          </div>
        )}

        <div className="h-px bg-sidebar-border" />

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <SideTooltip key={to} label={label} disabled={!collapsed}>
                <Link
                  to={to}
                  aria-label={label}
                  className={cn(
                    'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={labelClass(collapsed)}>{label}</span>
                  {to === '/sync' && unsynced > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white',
                        collapsed ? 'absolute right-1 top-0.5' : 'ml-auto',
                        failedCount > 0 ? 'bg-destructive' : 'bg-amber-500',
                      )}
                      title={`${pendingCount} pendientes · ${failedCount} con error`}
                    >
                      {unsynced}
                    </span>
                  )}
                </Link>
              </SideTooltip>
            )
          })}
        </nav>

        <div className="h-px bg-sidebar-border" />

        {/* Usuario + salir */}
        <div className="px-3 py-4 space-y-2">
          {user && !collapsed && (
            <div className="px-3 py-2 whitespace-nowrap">
              <p className="text-xs font-medium text-sidebar-foreground">{user.username}</p>
              <p className="text-xs text-sidebar-foreground/50">{user.userType}</p>
            </div>
          )}
          <SideTooltip label="Cerrar sesión" disabled={!collapsed}>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="size-4 shrink-0" />
              <span className={labelClass(collapsed)}>Cerrar sesión</span>
            </button>
          </SideTooltip>
        </div>

        {logoutDialog}
      </aside>
    </TooltipProvider>
  )
}
