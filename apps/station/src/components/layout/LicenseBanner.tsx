import { format } from 'date-fns'
import { Clock, KeyRound, Lock } from 'lucide-react'
import { useLicense } from '@/context/LicenseContext'

export const LICENSE_READ_ONLY_BANNER = 'Licencia vencida: solo lectura. Avisa al administrador.'
export const CLOCK_SKEW_MESSAGE =
  'El reloj de este equipo está atrasado respecto de la última validación de la licencia.'

const day = (iso: string | null) => (iso ? format(new Date(iso), 'dd/MM/yyyy') : '—')

/** Solo en modo CCI1: en LEGACY `useLicense().license` es null y no se muestra nada. */
export function LicenseBanner() {
  const { license } = useLicense()
  if (!license) return null

  let main: React.ReactNode = null
  if (license.status === 'READ_ONLY') {
    main = (
      <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-1.5 text-sm shrink-0">
        <Lock className="size-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium">{LICENSE_READ_ONLY_BANNER}</span>
      </div>
    )
  } else if (license.status === 'GRACE') {
    main = (
      <div className="flex items-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs shrink-0">
        <KeyRound className="size-3.5 text-amber-600 shrink-0" />
        <span className="text-amber-700">
          Licencia vencida el {day(license.expiresAt)}. Pasa a solo lectura el {day(license.graceEndsAt)}. Avisa al administrador.
        </span>
      </div>
    )
  } else if (license.status === 'DUE_SOON') {
    main = (
      <div className="flex items-center gap-2 bg-muted border-b px-4 py-1.5 text-xs shrink-0">
        <KeyRound className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">La licencia vence el {day(license.expiresAt)}.</span>
      </div>
    )
  }

  return (
    <>
      {main}
      {license.clockSkewDetected && (
        <div className="flex items-center gap-2 bg-muted border-b px-4 py-1.5 text-xs shrink-0">
          <Clock className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{CLOCK_SKEW_MESSAGE}</span>
        </div>
      )}
    </>
  )
}
