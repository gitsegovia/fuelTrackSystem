'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Fuel, Users, Droplets, Database, HardHat, Coins, Tag,
  FileText, ShieldCheck, CreditCard, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { canAccessRoute } from '@/lib/permissions'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/shared/BrandMark'

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
      { href: '/admin/invoice-payments', label: 'Pagos de Facturas', icon: CreditCard },
    ],
  },
  {
    label: 'Auditoría',
    items: [
      { href: '/admin/audit', label: 'Auditoría', icon: ShieldCheck },
    ],
  },
]

// T-075 (_sidebar-plegable.md): clave de localStorage para recordar el estado
// plegado/expandido entre recargas. Expandido por defecto.
const COLLAPSE_STORAGE_KEY = 'estacion360.sidebar.collapsed'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 overflow-hidden',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-[72px] shrink-0 items-center py-5', collapsed ? 'justify-center px-0' : 'justify-between px-5')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  aria-label="Abrir barra lateral"
                  className="group relative flex size-8 shrink-0 items-center justify-center outline-none"
                >
                  <Image
                    src="/brand/estacion360-symbol.png"
                    alt=""
                    width={32}
                    height={32}
                    className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
                  />
                  <PanelLeftOpen className="absolute inset-0 m-auto size-5 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              }
            />
            <TooltipContent side="right">Abrir barra lateral</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <BrandMark size={32} onDark textClassName="text-base" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    aria-label="Ocultar barra lateral"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <PanelLeftClose className="size-4" />
                  </button>
                }
              />
              <TooltipContent side="bottom">Ocultar barra lateral</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 space-y-4 scrollbar-thin">
        {navGroups.map((group, i) => {
          const items = group.items.filter(({ href }) => canAccessRoute(user, href))
          if (items.length === 0) return null
          return (
          <div key={i} className="space-y-0.5">
            {group.label && (
              collapsed
                ? <Separator className="bg-sidebar-border my-2" />
                : (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 whitespace-nowrap">
                    {group.label}
                  </p>
                )
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              const link = (
                <Link
                  key={href}
                  href={href}
                  aria-label={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      'overflow-hidden whitespace-nowrap transition-all',
                      collapsed ? 'max-w-0 opacity-0 duration-150' : 'max-w-[160px] opacity-100 duration-200 delay-75',
                    )}
                  >
                    {label}
                  </span>
                </Link>
              )
              if (!collapsed) return link
              return (
                <Tooltip key={href}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          )
        })}
      </nav>
    </aside>
  )
}
