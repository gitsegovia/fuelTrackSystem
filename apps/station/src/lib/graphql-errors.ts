import { CombinedGraphQLErrors } from '@apollo/client/errors'

// Códigos que el API devuelve en extensions.code (T-042, ADR-016).
export function graphQLErrorCode(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const code = err.errors[0]?.extensions?.code
  return typeof code === 'string' ? code : null
}

export const FORBIDDEN_MESSAGE = 'Tu usuario no tiene permiso para esta operación.'
export const LICENSE_READ_ONLY_MESSAGE = 'La licencia del sistema está vencida; la operación no se aplicó.'

/** Errores que reenviar no cambia: van directo a conflictos, sin reintentos (T-044, T-052). */
export const NON_RETRYABLE_MESSAGES: Record<string, string> = {
  FORBIDDEN: FORBIDDEN_MESSAGE,
  LICENSE_READ_ONLY: LICENSE_READ_ONLY_MESSAGE,
}
