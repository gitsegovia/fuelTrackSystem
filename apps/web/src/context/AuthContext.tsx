'use client'

import { createContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const apolloClient = useApolloClient()
  const [loginMutation] = useMutation<{
    login: { token: string; user: AuthUser }
  }>(MUTATIONS.login)

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
        localStorage.removeItem('accessToken')
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
    setUser(null)
    localStorage.removeItem('accessToken')
    apolloClient.clearStore()
    router.push(hadStation ? '/login' : '/admin-login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
