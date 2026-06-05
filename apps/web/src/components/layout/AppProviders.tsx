'use client'

import { useMemo } from 'react'
import { ApolloProvider } from '@apollo/client/react'
import { makeApolloClient } from '@/lib/apollo-client'
import { AuthProvider } from '@/context/AuthContext'
import { OfflineProvider } from '@/context/OfflineContext'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { Toaster } from '@/components/ui/sonner'

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Inicialización síncrona — el cache se restaura en segundo plano
  // sobre la misma instancia de InMemoryCache sin bloquear el render
  const client = useMemo(() => makeApolloClient(), [])

  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <OfflineProvider>
          <OfflineBanner />
          {children}
          <Toaster richColors position="top-right" />
        </OfflineProvider>
      </AuthProvider>
    </ApolloProvider>
  )
}
