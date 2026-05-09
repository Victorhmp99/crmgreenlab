import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchActivities, fetchActivityStats, type ActivityFilters } from '@/services/activities'

export function useActivities(filters: ActivityFilters = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['activities', tenantId, filters],
    queryFn:  () => fetchActivities(tenantId!, filters),
    enabled:  !!tenantId,
    placeholderData: (prev) => prev,
  })
}

export function useActivityStats() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['activity-stats', tenantId],
    queryFn:   () => fetchActivityStats(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60,
  })
}
