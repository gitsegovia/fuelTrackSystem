import { useEffect } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { StationSidebar } from './StationSidebar'
import { OfflineBanner } from './OfflineBanner'

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
    <div className="flex h-screen bg-background">
      <StationSidebar />
      <main className="flex flex-col flex-1 overflow-hidden">
        <OfflineBanner />
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
