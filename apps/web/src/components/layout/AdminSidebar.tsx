'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Fuel, Users, LogOut, Gauge, Droplets, Database, HardHat, Coins, Tag, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const navGroups = [
  {
    label: null,
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { href: '/admin/companies', label: 'Empresas', icon: Building2 },
      { href: '/admin/gas-stations', label: 'Estaciones', icon: Fuel },
      { href: '/admin/fuel-types', label: 'Combustibles', icon: Droplets },
      { href: '/admin/tank-models', label: 'Modelos de Tanque', icon: Database },
      { href: '/admin/users', label: 'Usuarios', icon: Users },
      { href: '/admin/employees', label: 'Empleados', icon: HardHat },
      { href: '/admin/currencies', label: 'Monedas', icon: Coins },
      { href: '/admin/sale-type-configs', label: 'Tipos de venta', icon: Tag },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/admin/invoices', label: 'Facturas', icon: FileText },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Gauge className="size-5 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold tracking-tight">FuelTrack</span>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {navGroups.map((group, i) => (
          <div key={i} className="space-y-0.5">
            {group.label && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
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
          </div>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User + Logout */}
      <div className="px-3 py-4 space-y-2">
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground">{user.username}</p>
            <p className="text-xs text-sidebar-foreground/50">{user.role}</p>
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
