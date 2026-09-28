import { createContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useApolloClient } from '@apollo/client/react'
import { toast } from 'sonner'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/login'
import type { AuthContextValue, AuthUser, LoginParams, ErrCallbackType } from '@/types/auth'
import { setStoredUserId, clearStoredUserId } from '@/lib/device-fingerprint'
import { cacheRestored, isNetworkDown } from '@/lib/apollo-client'
import {
  clearSession,
  endSessionOnServer,
  ensureFreshAccessToken,
  getRefreshToken,
  saveSession,
  setSessionEndedCallback,
  type SessionTokens,
} from '@/lib/auth-session'

const defaultContext: AuthContextValue = {
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
}

export const AuthContext = createContext<AuthContextValue>(defaultContext)

// Cada cuánto se revisa si conviene renovar el access token (ver auth-session.ts).
const REFRESH_CHECK_INTERVAL_MS = 20_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const apolloClient = useApolloClient()
  const [loginMutation] = useMutation<{ login: SessionTokens }>(MUTATIONS.login)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setLoading(false)
        return
      }
      // El restore reemplaza el cache completo: si terminara después, borraría el `me` recién leído.
      await cacheRestored
      try {
        const { data } = await apolloClient.query<{ me: AuthUser | null }>({
          query: QUERIES.me,
          fetchPolicy: 'network-only',
        })
        if (data?.me) {
          setUser(data.me)
        } else {
          // Con red, el servidor dice que no hay usuario: la sesión terminó.
          clearSession()
        }
      } catch (err) {
        const status = (err as any)?.statusCode
        if (isNetworkDown(err) || (typeof status === 'number' && status >= 500)) {
          // Sin red o servidor caído: nunca cerrar la sesión. Se usa el `me` persistido (lo escribe el login).
          const cached = apolloClient.readQuery<{ me: AuthUser | null }>({ query: QUERIES.me })
          if (cached?.me) setUser(cached.me)
        } else {
          clearSession()
        }
      } finally {
        setLoading(false)
      }
    }
    initAuth()
  }, [apolloClient])

  // ADR-014: mientras haya sesión, revisa periódicamente si el access token está por vencer
  // y lo renueva con margen (auth-session.ts). Si el servidor dice que hay que re-loguearse
  // (los 4 códigos de refreshSession), el callback de abajo cierra la sesión sin tocar la cola.
  useEffect(() => {
    if (!user) return
    const check = () => {
      ensureFreshAccessToken(apolloClient).catch(() => {
        // SessionEndedError ya lo maneja el callback; un error de red se reintenta solo.
      })
    }
    check()
    const id = setInterval(check, REFRESH_CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user, apolloClient])

  useEffect(() => {
    setSessionEndedCallback((err) => {
      setUser(null)
      clearStoredUserId()
      apolloClient.clearStore().catch(() => {})
      navigate('/login', { replace: true })
      toast.error(err.message, { id: 'session-ended' })
    })
  }, [apolloClient, navigate])

  const login = async (params: LoginParams, errorCallback?: ErrCallbackType) => {
    try {
      const { data } = await loginMutation({
        variables: { input: { username: params.username, password: params.password } },
        context: { skipOfflineLink: true },
      })
      if (data?.login?.token) {
        if (data.login.user.assignedGasStation) {
          saveSession(data.login)
          setStoredUserId(data.login.user.username)
          setUser(data.login.user)
          // Deja `me` en el cache persistido: una recarga sin red conserva la sesión.
          apolloClient.writeQuery({ query: QUERIES.me, data: { me: data.login.user } })
          navigate('/dashboard', { replace: true })
        } else {
          // Usuario sin estación asignada no puede usar el panel de estación
          if (errorCallback) errorCallback(new Error('Esta cuenta no tiene acceso a una estación de servicio.'))
        }
      }
    } catch (err) {
      if (errorCallback) errorCallback(err)
    }
  }

  const logout = () => {
    const refreshToken = getRefreshToken()
    setUser(null)
    clearSession()
    clearStoredUserId()
    apolloClient.clearStore()
    navigate('/login', { replace: true })
    // Best-effort: revoca la sesión en el servidor si hay red. La cola offline (IndexedDB)
    // no se toca — sigue disponible para sincronizar después del próximo login (T-004).
    if (refreshToken) endSessionOnServer(apolloClient, refreshToken)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
