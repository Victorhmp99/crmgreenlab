import { useAuth } from './useAuth'
import type { UserRole } from '@/types'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  manager: 2,
  seller: 1,
}

export function usePermissions() {
  const { role } = useAuth()

  function hasRole(required: UserRole): boolean {
    if (!role) return false
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required]
  }

  return {
    isAdmin: role === 'admin',
    isManager: hasRole('manager'),
    isSeller: !!role,
    hasRole,
    role,
  }
}
