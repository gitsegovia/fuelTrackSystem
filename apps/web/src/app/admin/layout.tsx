'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminTopbar } from '@/components/layout/AdminTopbar'
import { LicenseBanner } from '@/components/layout/LicenseBanner'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { Skeleton } from '@/components/ui/skeleton'
import { LicenseProvider } from '@/context/LicenseContext'
import { canAccessAdminPanel, canAccessRoute } from '@/lib/permissions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const panelAllowed = canAccessAdminPanel(user)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/admin-login')
    } else if (!panelAllowed) {
      router.replace(user.assignedGasStation ? '/station/dashboard' : '/admin-login')
    }
  }, [user, loading, panelAllowed, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-48">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!user || !panelAllowed) return null

  return (
    <LicenseProvider>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar />
          <LicenseBanner />
          <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {canAccessRoute(user, pathname) ? children : <AccessDenied />}
          </main>
        </div>
      </div>
    </LicenseProvider>
  )
}
