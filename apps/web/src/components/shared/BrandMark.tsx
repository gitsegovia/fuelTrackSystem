import Image from 'next/image'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  size?: number
  onDark?: boolean
  textClassName?: string
  className?: string
  stacked?: boolean
}

// «Estación» en texto plano (no en la imagen) para que lleve la tilde; en fondos oscuros
// (sidebar) pasa a blanco, en claros (logins) a gris oscuro. «360» siempre en azul de marca.
export function BrandMark({ size = 32, onDark = false, textClassName, className, stacked = false }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', stacked && 'flex-col gap-3', className)}>
      <Image
        src="/brand/estacion360-symbol.png"
        alt="Estación360"
        width={size}
        height={size}
        priority
      />
      <span
        className={cn(
          'font-bold tracking-tight',
          onDark ? 'text-white' : 'text-zinc-800',
          textClassName,
        )}
      >
        Estación<span className="text-[#1E88E5]">360</span>
      </span>
    </div>
  )
}
