import { useQuery } from '@tanstack/react-query'
import { fetchLeadPurchases } from '@/services/financial'

export function useLeadPurchases(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead-purchases', leadId],
    queryFn:   () => fetchLeadPurchases(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}
