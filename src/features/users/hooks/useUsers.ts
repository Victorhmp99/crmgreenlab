import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchTenantUsers, fetchInvites } from '@/services/users'

export function useUsers() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['users', tenantId],
    queryFn:  () => fetchTenantUsers(tenantId!),
    enabled:  !!tenantId,
  })
}

export function useInvites() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['invites', tenantId],
    queryFn:  () => fetchInvites(tenantId!),
    enabled:  !!tenantId,
  })
}
