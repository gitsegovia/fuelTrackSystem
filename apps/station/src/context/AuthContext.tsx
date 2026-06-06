import { createContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useApolloClient } from '@apollo/client/react'
import { MUTATIONS, QUERIES } from '@/services/graphql/gql/login'
import type { AuthContextValue, AuthUser, LoginParams, ErrCallbackType } from '@/types/auth'

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
  const navigate = useNavigate()
  const apolloClient = useApolloClient()
  const [loginMutation] = useMutation<{ login: { token: string; user: AuthUser } }>(MUTATIONS.login)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken')
      if (!token) {
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
        } else {
          localStorage.removeItem('accessToken')
        }
      } catch {
        // Si falla (sin conexión), intentar con cache
        const cached = apolloClient.readQuery<{ me: AuthUser | null }>({ query: QUERIES.me })
        if (cached?.me) {
          setUser(cached.me)
        } else {
          localStorage.removeItem('accessToken')
        }
      } finally {
        setLoading(false)
      }
    }
    initAuth()
  }, [apolloClient])

  const login = async (params: LoginParams, errorCallback?: ErrCallbackType) => {
    try {
      const { data } = await loginMutation({
        variables: { input: { username: params.username, password: params.password } },
      })
      if (data?.login?.token) {
        localStorage.setItem('accessToken', data.login.token)
        setUser(data.login.user)
        if (data.login.user.assignedGasStation) {
          navigate('/dashboard', { replace: true })
        } else {
          // Usuario sin estación asignada no puede usar el panel de estación
          localStorage.removeItem('accessToken')
          if (errorCallback) errorCallback(new Error('Esta cuenta no tiene acceso a una estación de servicio.'))
        }
      }
    } catch (err) {
      if (errorCallback) errorCallback(err)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('accessToken')
    apolloClient.clearStore()
    navigate('/login', { replace: true })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
