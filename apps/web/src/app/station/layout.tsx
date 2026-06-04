'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { StationSidebar } from '@/components/layout/StationSidebar'

export default function StationLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login')
      } else if (!user.assignedGasStation) {
        router.replace('/admin/dashboard')
      }
    }
  }, [user, loading, router])

  if (loading || !user || !user.assignedGasStation) return null

  return (
    <div className="flex h-screen bg-background">
      <StationSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
