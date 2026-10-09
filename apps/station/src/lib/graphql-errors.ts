import { CombinedGraphQLErrors } from '@apollo/client/errors'

// Códigos que el API devuelve en extensions.code (T-042, ADR-016).
export function graphQLErrorCode(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const code = err.errors[0]?.extensions?.code
  return typeof code === 'string' ? code : null
}

export const FORBIDDEN_MESSAGE = 'Tu usuario no tiene permiso para esta operación.'
export const LICENSE_READ_ONLY_MESSAGE = 'La licencia del sistema está vencida; la operación no se aplicó.'
export const STATION_INACTIVE_OPERATION_MESSAGE = 'La estación fue desactivada; la operación no se aplicó.'
export const STATION_INACTIVE_LOGIN_MESSAGE = 'Tu estación está desactivada. Contacta al administrador.'

/** Errores que reenviar no cambia: van directo a conflictos, sin reintentos (T-044, T-052, T-057). */
export const NON_RETRYABLE_MESSAGES: Record<string, string> = {
  FORBIDDEN: FORBIDDEN_MESSAGE,
  LICENSE_READ_ONLY: LICENSE_READ_ONLY_MESSAGE,
  STATION_INACTIVE: STATION_INACTIVE_OPERATION_MESSAGE,
}
