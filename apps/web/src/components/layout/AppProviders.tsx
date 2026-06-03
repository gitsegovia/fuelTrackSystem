'use client'

import { useMemo } from 'react'
import { ApolloProvider } from '@apollo/client/react'
import { makeApolloClient } from '@/lib/apollo-client'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => makeApolloClient(), [])

  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ApolloProvider>
  )
}
