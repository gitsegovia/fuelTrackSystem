import type { useApolloClient } from '@apollo/client/react'
import { MUTATIONS } from '@/services/graphql/gql/login'
import { isNetworkDown } from './apollo-client'
import { STATION_INACTIVE_LOGIN_MESSAGE, graphQLErrorCode } from './graphql-errors'
import type { AuthUser } from '@/types/auth'

type ApolloClientInstance = ReturnType<typeof useApolloClient>

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const ACCESS_EXPIRES_KEY = 'accessTokenExpiresAt'
const SESSION_EXPIRES_KEY = 'sessionExpiresAt'

// Margen para refrescar antes de que venza el access token. Deliberadamente menor que la
// ventana de gracia del servidor (REFRESH_GRACE_SECONDS, default 60s, T-019): el margen decide
// CUÁNDO refrescar; la gracia es la red de seguridad del servidor si esa respuesta se pierde.
const REFRESH_MARGIN_MS = 45_000
const REFRESH_LOCK = 'fueltrack-token-refresh'

export type SessionErrorCode =
  | 'INVALID_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_REUSED'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'
  | 'STATION_INACTIVE'

const SESSION_ERROR_CODES = new Set<SessionErrorCode>([
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'STATION_INACTIVE',
])

export class SessionEndedError extends Error {
  code: SessionErrorCode
  constructor(code: SessionErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface SessionTokens {
  token: string
  accessTokenExpiresAt: string
  refreshToken: string
  sessionExpiresAt: string
  user: AuthUser
}

// ── Persistencia local ──────────────────────────────────────────────────────

export function saveSession(data: SessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.token)
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
  localStorage.setItem(ACCESS_EXPIRES_KEY, data.accessTokenExpiresAt)
  localStorage.setItem(SESSION_EXPIRES_KEY, data.sessionExpiresAt)
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(ACCESS_EXPIRES_KEY)
  localStorage.removeItem(SESSION_EXPIRES_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function getAccessTokenExpiresAt(): number | null {
  const raw = localStorage.getItem(ACCESS_EXPIRES_KEY)
  const t = raw ? Date.parse(raw) : NaN
  return Number.isNaN(t) ? null : t
}

function isAccessTokenFresh(): boolean {
  const exp = getAccessTokenExpiresAt()
  return exp !== null && exp - Date.now() > REFRESH_MARGIN_MS
}

// ── Notifica a AuthContext que hay que pedir credenciales de nuevo ─────────────
// Mismo patrón que onMutationQueued en apollo-client.ts: un callback de módulo que
// el provider registra una vez, para no tener que pasar el contexto de React hasta acá.

let onSessionEnded: ((err: SessionEndedError) => void) | null = null
export function setSessionEndedCallback(fn: (err: SessionEndedError) => void) {
  onSessionEnded = fn
}

function extractSessionErrorCode(err: unknown): SessionErrorCode | null {
  const code = graphQLErrorCode(err)
  return code && SESSION_ERROR_CODES.has(code as SessionErrorCode) ? (code as SessionErrorCode) : null
}

function sessionEndedMessage(code: SessionErrorCode): string {
  switch (code) {
    case 'SESSION_EXPIRED':
      return 'Tu sesión venció. Inicia sesión otra vez.'
    case 'REFRESH_TOKEN_REUSED':
      return 'Se detectó un uso indebido de la sesión. Inicia sesión otra vez.'
    case 'SESSION_REVOKED':
      return 'La sesión fue cerrada. Inicia sesión otra vez.'
    case 'INVALID_REFRESH_TOKEN':
      return 'La sesión ya no es válida. Inicia sesión otra vez.'
    case 'STATION_INACTIVE':
      return STATION_INACTIVE_LOGIN_MESSAGE
  }
}

// ── Refresh ──────────────────────────────────────────────────────────────────

let inTabRefresh: Promise<void> | null = null

/** Cierra la sesión local, avisa a la UI (login con aviso) y devuelve el error para lanzarlo. */
export function expireSession(code: SessionErrorCode): SessionEndedError {
  const ended = new SessionEndedError(code, sessionEndedMessage(code))
  clearSession()
  onSessionEnded?.(ended)
  return ended
}

/**
 * Renueva el access token si está por vencer y hay red. Debe llamarse antes de operar y
 * siempre antes de sincronizar la cola (processQueue/syncQueue).
 *
 * Sin red no intenta nada: el token vencido no bloquea nada hoy (el servidor no valida el
 * JWT — H-001) y se reintenta la próxima vez que haya red. Un solo refresh a la vez entre
 * llamadas concurrentes de la misma pestaña y entre pestañas (navigator.locks).
 *
 * Lanza `SessionEndedError` si el servidor dice que hay que pedir credenciales (los 4
 * códigos de refreshSession). La cola offline (IndexedDB) no se toca: sigue disponible
 * para sincronizar después del login. No lanza nada por un error de red.
 */
export async function ensureFreshAccessToken(client: ApolloClientInstance): Promise<void> {
  if (isAccessTokenFresh()) return
  return startRefresh(client, false)
}

/**
 * Renueva aunque el reloj diga que el access token sigue vigente: el servidor lo rechazó
 * (UNAUTHENTICATED, T-042 — p. ej. sesión revocada desde otro lado).
 */
export async function forceRefreshAccessToken(client: ApolloClientInstance): Promise<void> {
  return startRefresh(client, true)
}

function startRefresh(client: ApolloClientInstance, force: boolean): Promise<void> {
  if (!getRefreshToken() || !navigator.onLine) return Promise.resolve()

  const run = async () => {
    if (navigator.locks) {
      await navigator.locks.request(REFRESH_LOCK, () => doRefresh(client, force))
    } else {
      await doRefresh(client, force)
    }
  }
  if (!inTabRefresh) {
    inTabRefresh = run().finally(() => {
      inTabRefresh = null
    })
  }
  return inTabRefresh
}

/**
 * Operación online con sesión rechazada: renueva y reintenta una vez. Si el reintento vuelve a
 * fallar con UNAUTHENTICATED, la sesión termina (pide login; la cola offline no se toca).
 */
export async function withSessionRetry<T>(client: ApolloClientInstance, send: () => Promise<T>): Promise<T> {
  try {
    return await send()
  } catch (err) {
    if (graphQLErrorCode(err) !== 'UNAUTHENTICATED') throw err
  }
  await forceRefreshAccessToken(client)
  try {
    return await send()
  } catch (err) {
    if (graphQLErrorCode(err) === 'UNAUTHENTICATED') throw expireSession('INVALID_REFRESH_TOKEN')
    throw err
  }
}

async function doRefresh(client: ApolloClientInstance, force: boolean): Promise<void> {
  // Otra pestaña (o una llamada que esperó el lock en esta) pudo haber renovado ya.
  if (!force && isAccessTokenFresh()) return
  const refreshToken = getRefreshToken()
  if (!refreshToken) return

  try {
    const { data } = await client.mutate<{ refreshSession: SessionTokens }>({
      mutation: MUTATIONS.refreshSession,
      variables: { refreshToken },
      // No debe encolarse offline ni llevar x-offline-mutation-id (T-009): está fuera
      // del wrapper de idempotencia.
      context: { skipOfflineLink: true },
    })
    if (data?.refreshSession) saveSession(data.refreshSession)
  } catch (err) {
    const code = extractSessionErrorCode(err)
    if (code) throw expireSession(code)
    if (!isNetworkDown(err)) throw err
    // Error de red: se deja el refresh actual intacto (T-019 lo tolera dentro de su
    // ventana de gracia) y se reintenta en el próximo llamado.
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────

/** Revoca la sesión en el servidor. Best-effort: no bloquea ni reintenta el logout local. */
export async function endSessionOnServer(client: ApolloClientInstance, refreshToken: string): Promise<void> {
  if (!navigator.onLine) return
  try {
    await client.mutate({
      mutation: MUTATIONS.logout,
      variables: { refreshToken },
      context: { skipOfflineLink: true },
    })
  } catch {
    // La sesión igual se cierra localmente.
  }
}
