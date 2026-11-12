'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useLicense } from '@/context/LicenseContext'
import { isAdminRole } from '@/lib/permissions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Empleado',
}

const USER_TYPE_LABELS: Record<string, string> = {
  Administrator: 'Administrador',
  Supervisor: 'Supervisor',
  Cashier: 'Cajero',
  FuelAttendant: 'Bombero',
  Administrative: 'Administrativo',
}

export function AdminTopbar() {
  const { user, logout } = useAuth()
  const { license } = useLicense()
  const router = useRouter()

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'FT'

  const showLicense = isAdminRole(user) && license?.mode === 'CCI1'

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : ''
  const userTypeLabel = user?.userType ? USER_TYPE_LABELS[user.userType] ?? user.userType : ''
  const cargoLabel = userTypeLabel && userTypeLabel !== roleLabel ? userTypeLabel : null

  return (
    <header className="relative flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: 'var(--brand-gradient)' }} />
      <div />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menú de usuario"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{user?.username}</p>
            <p className="text-xs text-muted-foreground">
              {roleLabel}
              {cargoLabel ? ` · ${cargoLabel}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">{user?.company?.name}</p>
          </div>
          {showLicense && license && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Licencia
                </p>
                <p className="text-xs text-muted-foreground">
                  Plan {license.plan ?? '—'} · {license.customerName ?? '—'}
                </p>
                {license.trial && (
                  <p className="text-xs text-amber-500">
                    Período de prueba — termina el {license.expiresAt ? format(new Date(license.expiresAt), 'dd/MM/yyyy') : '—'}
                  </p>
                )}
                {!license.trial && (
                  <p className="text-xs text-muted-foreground">
                    Vence: {license.expiresAt ? format(new Date(license.expiresAt), 'dd/MM/yyyy') : '—'}
                  </p>
                )}
                {license.maxStations != null && (
                  <p className="text-xs text-muted-foreground">
                    Estaciones: {license.activeStations} de {license.maxStations}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/70">
                  Última validación: {license.lastValidatedAt ? format(new Date(license.lastValidatedAt), 'dd/MM/yyyy HH:mm') : '—'}
                </p>
              </div>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => router.push('/admin/profile')}>
            <User className="size-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
