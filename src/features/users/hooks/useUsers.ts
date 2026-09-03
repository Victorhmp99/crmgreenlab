import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchTenantUsers, fetchInvites } from '@/services/users'

// `enabled` existe porque `get_tenant_users` e restrita a gestor/admin:
// chamar sendo vendedor devolve "Unauthorized" e polui o console a toa.
export function useUsers(opcoes?: { enabled?: boolean }) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['users', tenantId],
    queryFn:  () => fetchTenantUsers(tenantId!),
    enabled:  !!tenantId && (opcoes?.enabled ?? true),
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
