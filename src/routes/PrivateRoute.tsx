import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { IdleWarning } from '@/components/layout/IdleWarning'

// O Master nunca é bloqueado — proteção hardcoded
const MASTER_EMAIL = 'assessoriagreenlab@gmail.com'

export function PrivateRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const accountStatus = useAuthStore((s) => s.accountStatus)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const isMaster = user?.email?.toLowerCase() === MASTER_EMAIL

  if (!isMaster && accountStatus === 'pending')  return <Navigate to="/aguardando" replace />
  if (!isMaster && accountStatus === 'blocked')  return <Navigate to="/bloqueado"  replace />

  return (
    <>
      <IdleWarning />
      <Outlet />
    </>
  )
}
