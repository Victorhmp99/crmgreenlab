import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import {
  fetchSellerPerformance,
  fetchFunnelBreakdown,
  fetchCampaignPerformance,
  fetchSourceBreakdown,
} from '@/services/reports'

export function useSellerPerformance(startDate: string, endDate: string) {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-sellers', tenantId, startDate, endDate],
    queryFn:   () => fetchSellerPerformance(tenantId!, startDate, endDate),
    enabled:   !!tenantId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
  })
}

export function useFunnelBreakdown() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-funnel', tenantId],
    queryFn:   () => fetchFunnelBreakdown(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCampaignPerformance() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-campaigns', tenantId],
    queryFn:   () => fetchCampaignPerformance(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSourceBreakdown() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  return useQuery({
    queryKey:  ['report-sources', tenantId],
    queryFn:   () => fetchSourceBreakdown(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}
