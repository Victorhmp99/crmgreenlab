import { useQuery } from '@tanstack/react-query'
import { fetchLeadById } from '@/services/leads'

export function useLead(leadId: string | null) {
  return useQuery({
    queryKey:  ['lead', leadId],
    queryFn:   () => fetchLeadById(leadId!),
    enabled:   !!leadId,
    staleTime: 1000 * 30,
  })
}
