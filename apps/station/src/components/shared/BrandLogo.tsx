import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Símbolo de Estación360 + nombre en HTML (lleva tilde). `tone` ajusta el color de «Estación» al fondo. */
export function BrandLogo({
  className,
  textClassName,
  symbolClassName = 'size-9',
  tone = 'light',
  showText = true,
  subtitle,
  subtitleClassName,
}: {
  className?: string
  textClassName?: string
  symbolClassName?: string
  /** light = sobre fondo claro (texto oscuro), dark = sobre fondo oscuro (texto blanco) */
  tone?: 'light' | 'dark'
  showText?: boolean
  /** Línea secundaria bajo el nombre (p. ej. la estación). */
  subtitle?: React.ReactNode
  subtitleClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img
        src="/brand/estacion360-symbol.png"
        alt=""
        className={cn(
          'shrink-0 object-contain',
          // sobre fondo oscuro los tramos azul-verdoso oscuro se pierden: pastilla blanca
          tone === 'dark' && 'rounded-xl bg-white p-1',
          symbolClassName,
        )}
      />
      {showText && (
        <span className="min-w-0 flex flex-col gap-1">
          <span className={cn('font-bold tracking-tight leading-none', textClassName)}>
            <span className={tone === 'dark' ? 'text-white' : 'text-slate-800'}>Estación</span>
            <span className="text-[#1E88E5]">360</span>
          </span>
          {subtitle && <span className={cn('truncate leading-tight', subtitleClassName)}>{subtitle}</span>}
        </span>
      )}
    </span>
  )
}
