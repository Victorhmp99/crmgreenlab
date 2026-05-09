import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'

export function SuperAdminRoute() {
  const { isSuperAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return isSuperAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />
}
