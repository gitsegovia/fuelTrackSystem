/** SalesTicketStatus (ADR-015). Mismo texto en todas las pantallas. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Emitido',
  PAID: 'Pagado — pendiente de despacho',
  DISPATCHED: 'Despachado — pendiente de cobro',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Tono de la insignia de estado de cada estado de ticket. */
export const TICKET_STATUS_TONES: Record<string, StatusTone> = {
  ISSUED: 'neutral',
  PAID: 'info',
  DISPATCHED: 'warning',
  COMPLETED: 'success',
  CANCELED: 'danger',
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  PREPAID: 'Prepago',
  POSTPAID: 'Postpago',
}

/** Prepago: cobrar antes de despachar. Postpago: despachar antes de cobrar. */
export function canPay(mode: string, status: string): boolean {
  return mode === 'PREPAID' ? status === 'ISSUED' : status === 'DISPATCHED'
}

export function canDispatch(mode: string, status: string): boolean {
  return mode === 'PREPAID' ? status === 'PAID' : status === 'ISSUED'
}

export function isOpenTicket(status: string): boolean {
  return status !== 'COMPLETED' && status !== 'CANCELED'
}
