'use client'

import { AlertTriangle, Info, Ban, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useLicense } from '@/context/LicenseContext'
import { useAuth } from '@/hooks/useAuth'
import { isAdminRole } from '@/lib/permissions'
import { LICENSE_READ_ONLY_MESSAGE } from '@/lib/license-messages'
import { cn } from '@/lib/utils'

function fmt(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), 'dd/MM/yyyy')
}

function Strip({
  tone, icon: Icon, children,
}: { tone: 'info' | 'warning' | 'error'; icon: typeof Info; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-4 py-2 text-sm font-medium border-b',
        tone === 'error' && 'bg-destructive/10 text-destructive border-destructive/20',
        tone === 'warning' && 'bg-amber-50 text-amber-800 border-amber-200',
        tone === 'info' && 'bg-blue-50 text-blue-800 border-blue-200'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function LicenseBanner() {
  const { license } = useLicense()
  const { user } = useAuth()

  if (!license || license.mode !== 'CCI1') return null

  return (
    <>
      {license.status === 'READ_ONLY' && <Strip tone="error" icon={Ban}>{LICENSE_READ_ONLY_MESSAGE}</Strip>}
      {license.status === 'GRACE' && (
        <Strip tone="warning" icon={AlertTriangle}>
          La licencia venció el {fmt(license.expiresAt)}; el sistema pasa a solo lectura el {fmt(license.graceEndsAt)}.
        </Strip>
      )}
      {license.status === 'DUE_SOON' && (
        <Strip tone="info" icon={Info}>
          La licencia vence en {license.daysRemaining} día{license.daysRemaining === 1 ? '' : 's'}.
        </Strip>
      )}
      {license.clockSkewDetected && isAdminRole(user) && (
        <Strip tone="info" icon={Clock}>
          El reloj de este equipo está atrasado respecto de la última validación de la licencia.
        </Strip>
      )}
    </>
  )
}
