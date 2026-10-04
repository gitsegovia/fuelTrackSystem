/** SalesTicketStatus (ADR-015). Mismo texto en todas las pantallas. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Emitido',
  PAID: 'Pagado — pendiente de despacho',
  DISPATCHED: 'Despachado — pendiente de cobro',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
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
