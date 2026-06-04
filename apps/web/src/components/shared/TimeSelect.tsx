'use client'

import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

interface TimeSelectProps {
  value?: string        // "HH:mm"
  onChange?: (value: string) => void
  disabled?: boolean
  'aria-invalid'?: boolean
}

export function TimeSelect({ value = '00:00', onChange, disabled, 'aria-invalid': invalid }: TimeSelectProps) {
  const [hh, mm] = value.split(':')

  const handleHour = (h: string) => onChange?.(`${h}:${mm ?? '00'}`)
  const handleMinute = (m: string) => onChange?.(`${hh ?? '00'}:${m}`)

  return (
    <div className="flex items-center gap-1">
      <select
        value={hh ?? '00'}
        onChange={(e) => handleHour(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(selectClass, 'w-16')}
      >
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-muted-foreground text-sm font-medium">:</span>
      <select
        value={mm ?? '00'}
        onChange={(e) => handleMinute(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(selectClass, 'w-16')}
      >
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}
