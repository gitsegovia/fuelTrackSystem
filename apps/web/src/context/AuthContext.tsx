'use client'

import { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useApolloClient } from '@apollo/client/react'
import { toast } from 'sonner'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/login'
import type { AuthContextValue, AuthUser, LoginParams, ErrCallbackType } from '@/types/auth'
import {
  readSessionTokens,
  writeSessionTokens,
  clearSessionTokens,
  requestRefreshSession,
  requestLogout,
  computeRefreshDelayMs,
  runExclusiveRefresh,
  SessionInvalidError,
  SESSION_ERROR_MESSAGES,
  REFRESH_TOKEN_STORAGE_KEY,
  NETWORK_RETRY_DELAY,
  type SessionTokens,
} from '@/lib/session'

const defaultContext: AuthContextValue = {
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
}

export const AuthContext = createContext<AuthContextValue>(defaultContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const apolloClient = useApolloClient()
  const [loginMutation] = useMutation<{
    login: {
      token: string
      accessTokenExpiresAt: string
      refreshToken: string
      sessionExpiresAt: string
      user: AuthUser
    }
  }>(MUTATIONS.login)

  const userRef = useRef<AuthUser | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // performRefresh y scheduleRefresh se necesitan mutuamente; una ref rompe el ciclo
  // sin forzar un orden de declaración entre los dos useCallback.
  const performRefreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    userRef.current = user
  }, [user])

  const clearScheduledRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const scheduleRefresh = useCallback(
    (accessTokenExpiresAt: string) => {
      clearScheduledRefresh()
      refreshTimerRef.current = setTimeout(() => {
        void performRefreshRef.current()
      }, computeRefreshDelayMs(accessTokenExpiresAt))
    },
    [clearScheduledRefresh]
  )

  const goToLogin = useCallback(
    (message?: string) => {
      const hadStation = !!userRef.current?.assignedGasStation
      clearScheduledRefresh()
      clearSessionTokens()
      setUser(null)
      apolloClient.clearStore().catch(() => {})
      if (message) toast.error(message)
      router.replace(hadStation ? '/login' : '/admin-login')
    },
    [apolloClient, clearScheduledRefresh, router]
  )

  const performRefresh = useCallback(async () => {
    const before = readSessionTokens()
    if (!before) {
      goToLogin()
      return
    }
    try {
      const updated = await runExclusiveRefresh<SessionTokens>(async () => {
        const current = readSessionTokens()
        if (!current) throw new SessionInvalidError('SESSION_REVOKED', 'Sesión local ausente.')
        if (current.refreshToken !== before.refreshToken) {
          // Otra pestaña ya rotó el refresh mientras esperábamos el lock.
          return current
        }
        const fresh = await requestRefreshSession(current.refreshToken)
        writeSessionTokens(fresh)
        return fresh
      })
      scheduleRefresh(updated.accessTokenExpiresAt)
    } catch (err) {
      if (err instanceof SessionInvalidError) {
        goToLogin(SESSION_ERROR_MESSAGES[err.code])
      } else {
        // Error de red: no tocar el refresh, reintentar más tarde con el mismo.
        refreshTimerRef.current = setTimeout(() => {
          void performRefreshRef.current()
        }, NETWORK_RETRY_DELAY)
      }
    }
  }, [goToLogin, scheduleRefresh])

  useEffect(() => {
    performRefreshRef.current = performRefresh
  }, [performRefresh])

  useEffect(() => {
    const initAuth = async () => {
      const tokens = readSessionTokens()
      if (!tokens) {
        clearSessionTokens()
        setLoading(false)
        return
      }
      try {
        const { data } = await apolloClient.query<{ me: AuthUser | null }>({
          query: QUERIES.me,
          fetchPolicy: 'network-only',
        })
        if (data?.me) {
          setUser(data.me)
          scheduleRefresh(tokens.accessTokenExpiresAt)
        } else {
          clearSessionTokens()
        }
      } catch {
        clearSessionTokens()
      } finally {
        setLoading(false)
      }
    }
    initAuth()
    return () => clearScheduledRefresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apolloClient])

  // Si otra pestaña cierra la sesión (logout o sesión inválida), esta también sale.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REFRESH_TOKEN_STORAGE_KEY && e.newValue === null && userRef.current) {
        const hadStation = !!userRef.current.assignedGasStation
        clearScheduledRefresh()
        setUser(null)
        router.replace(hadStation ? '/login' : '/admin-login')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [clearScheduledRefresh, router])

  const login = async (params: LoginParams, errorCallback?: ErrCallbackType) => {
    try {
      const { data } = await loginMutation({
        variables: { input: { username: params.username, password: params.password } },
      })
      if (data?.login?.token) {
        writeSessionTokens({
          accessToken: data.login.token,
          refreshToken: data.login.refreshToken,
          accessTokenExpiresAt: data.login.accessTokenExpiresAt,
          sessionExpiresAt: data.login.sessionExpiresAt,
        })
        setUser(data.login.user)
        scheduleRefresh(data.login.accessTokenExpiresAt)
        if (data.login.user.assignedGasStation) {
          router.replace('/station/dashboard')
        } else {
          router.replace('/admin/dashboard')
        }
      }
    } catch (err) {
      if (errorCallback) errorCallback(err)
    }
  }

  const logout = () => {
    const hadStation = !!user?.assignedGasStation
    const tokens = readSessionTokens()
    clearScheduledRefresh()
    setUser(null)
    clearSessionTokens()
    apolloClient.clearStore()
    if (tokens) void requestLogout(tokens.refreshToken)
    router.push(hadStation ? '/login' : '/admin-login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
