import { ApolloProvider } from '@apollo/client/react'
import { Toaster } from 'sonner'
import { makeApolloClient } from '@/lib/apollo-client'
import { AuthProvider } from '@/context/AuthContext'
import { OfflineProvider } from '@/context/OfflineContext'

// Instancia única — no recrear en re-renders
const apolloClient = makeApolloClient()

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <OfflineProvider>
          {children}
          <Toaster richColors position="top-right" />
        </OfflineProvider>
      </AuthProvider>
    </ApolloProvider>
  )
}
