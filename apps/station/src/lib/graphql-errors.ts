import { CombinedGraphQLErrors } from '@apollo/client/errors'

// Códigos que el API devuelve en extensions.code (T-042, ADR-016).
export function graphQLErrorCode(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const code = err.errors[0]?.extensions?.code
  return typeof code === 'string' ? code : null
}

export const FORBIDDEN_MESSAGE = 'Tu usuario no tiene permiso para esta operación.'
