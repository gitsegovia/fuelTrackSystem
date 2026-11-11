import { useEffect } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { StationSidebar } from './StationSidebar'
import { MobileTopBar, MobileBottomNav } from './MobileChrome'
import { OfflineBanner } from './OfflineBanner'
import { LicenseBanner } from './LicenseBanner'

export function ProtectedLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user || !user.assignedGasStation) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || !user.assignedGasStation) return <Navigate to="/login" replace />

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      <StationSidebar />
      <MobileTopBar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <LicenseBanner />
        <OfflineBanner />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}
