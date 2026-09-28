/** Etiquetas de SalesTicketStatus. Texto tomado del detalle de ticket (la pantalla con más
 * contexto para el cajero) y compartido para que no diverja entre dashboard, listas y turno. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT_DISPATCH: 'Pendiente de pago y despacho',
  PAID_PENDING_DISPATCH: 'Pagado — pendiente de despacho',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado',
}
