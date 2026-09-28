// Refresh rotativo de sesión (ADR-014, T-018 — espejo de T-010/T-009).
// No usa Apollo a propósito: login/refreshSession/logout están fuera del wrapper
// de idempotencia offline (T-009) y no deben pasar por buildOfflineLink, que
// encolaría estas mutations en IndexedDB si la red cae.

export interface SessionTokens {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  sessionExpiresAt: string
}

const STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  accessTokenExpiresAt: 'accessTokenExpiresAt',
  sessionExpiresAt: 'sessionExpiresAt',
} as const

export function readSessionTokens(): SessionTokens | null {
  if (typeof window === 'undefined') return null
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  const accessTokenExpiresAt = localStorage.getItem(STORAGE_KEYS.accessTokenExpiresAt)
  const sessionExpiresAt = localStorage.getItem(STORAGE_KEYS.sessionExpiresAt)
  if (!accessToken || !refreshToken || !accessTokenExpiresAt || !sessionExpiresAt) return null
  return { accessToken, refreshToken, accessTokenExpiresAt, sessionExpiresAt }
}

export function writeSessionTokens(tokens: SessionTokens): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken)
  localStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, tokens.accessTokenExpiresAt)
  localStorage.setItem(STORAGE_KEYS.sessionExpiresAt, tokens.sessionExpiresAt)
}

export function clearSessionTokens(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

export const REFRESH_TOKEN_STORAGE_KEY = STORAGE_KEYS.refreshToken

export type SessionErrorCode =
  | 'INVALID_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_REUSED'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'

const SESSION_ERROR_CODES: readonly string[] = [
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
]

export const SESSION_ERROR_MESSAGES: Record<SessionErrorCode, string> = {
  INVALID_REFRESH_TOKEN: 'Tu sesión ya no es válida. Inicia sesión de nuevo.',
  REFRESH_TOKEN_REUSED: 'Se detectó un uso irregular de tu sesión y fue cerrada por seguridad. Inicia sesión de nuevo.',
  SESSION_REVOKED: 'Tu sesión fue cerrada. Inicia sesión de nuevo.',
  SESSION_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
}

export class SessionInvalidError extends Error {
  code: SessionErrorCode
  constructor(code: SessionErrorCode, message: string) {
    super(message)
    this.name = 'SessionInvalidError'
    this.code = code
  }
}

interface AuthPayloadResponse {
  token: string
  accessTokenExpiresAt: string
  refreshToken: string
  sessionExpiresAt: string
}

const GRAPHQL_URI = process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000/graphql'

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GRAPHQL_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors?.length) {
    const code = json.errors[0]?.extensions?.code
    if (typeof code === 'string' && SESSION_ERROR_CODES.includes(code)) {
      throw new SessionInvalidError(code as SessionErrorCode, json.errors[0].message)
    }
    throw new Error(json.errors[0]?.message ?? 'Error desconocido de sesión.')
  }
  return json.data as T
}

const REFRESH_SESSION_MUTATION = `
  mutation RefreshSession($refreshToken: String!) {
    refreshSession(refreshToken: $refreshToken) {
      token
      accessTokenExpiresAt
      refreshToken
      sessionExpiresAt
    }
  }
`

const LOGOUT_MUTATION = `
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`

export async function requestRefreshSession(refreshToken: string): Promise<SessionTokens> {
  const data = await graphqlRequest<{ refreshSession: AuthPayloadResponse }>(
    REFRESH_SESSION_MUTATION,
    { refreshToken }
  )
  const r = data.refreshSession
  return {
    accessToken: r.token,
    refreshToken: r.refreshToken,
    accessTokenExpiresAt: r.accessTokenExpiresAt,
    sessionExpiresAt: r.sessionExpiresAt,
  }
}

/** Best-effort: si la red falla, el llamador igual limpia la sesión local. */
export async function requestLogout(refreshToken: string): Promise<void> {
  try {
    await graphqlRequest(LOGOUT_MUTATION, { refreshToken })
  } catch {
    // ignorado a propósito
  }
}

// Renovar cuando queda el 25% de la vida del access token (nunca antes de MIN_DELAY_MS).
const REFRESH_AT_REMAINING_RATIO = 0.25
const MIN_DELAY_MS = 2_000
const NETWORK_RETRY_DELAY_MS = 5_000

export function computeRefreshDelayMs(accessTokenExpiresAt: string): number {
  const remaining = new Date(accessTokenExpiresAt).getTime() - Date.now()
  if (remaining <= 0) return 0
  return Math.max(remaining * (1 - REFRESH_AT_REMAINING_RATIO), MIN_DELAY_MS)
}

export const NETWORK_RETRY_DELAY = NETWORK_RETRY_DELAY_MS

const REFRESH_LOCK_NAME = 'fueltrack-web-refresh-session'

/** Un solo refresh en vuelo por dispositivo, incluso entre pestañas (Web Locks API). */
export async function runExclusiveRefresh<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, () => fn())
  }
  return fn()
}
