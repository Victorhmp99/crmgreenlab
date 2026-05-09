import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchLeads, type LeadFilters } from '@/services/leads'

export function useLeads(filters: LeadFilters = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['leads', tenantId, filters],
    queryFn: () => fetchLeads(tenantId!, filters),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  })
}
