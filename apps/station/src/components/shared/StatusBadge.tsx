import type * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_LABELS, TICKET_STATUS_TONES, type StatusTone } from '@/lib/ticket-status'

/** Única insignia de estado: fondo gris claro, borde negro y texto en negrita del color del estado. */
export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: StatusTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge variant="status" tone={tone} className={className}>
      {children}
    </Badge>
  )
}

export function TicketStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <StatusBadge tone={TICKET_STATUS_TONES[status] ?? 'neutral'} className={className}>
      {TICKET_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  )
}
