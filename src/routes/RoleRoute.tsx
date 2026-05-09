import { Navigate, Outlet } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import type { UserRole } from '@/types'

interface RoleRouteProps {
  required: UserRole
}

export function RoleRoute({ required }: RoleRouteProps) {
  const { hasRole } = usePermissions()
  return hasRole(required) ? <Outlet /> : <Navigate to="/dashboard" replace />
}
