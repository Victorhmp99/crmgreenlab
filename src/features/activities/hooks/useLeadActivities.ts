import { useQuery } from '@tanstack/react-query'
import { fetchLeadActivities } from '@/services/activities'

export function useLeadActivities(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn:  () => fetchLeadActivities(leadId!),
    enabled:  !!leadId,
  })
}
