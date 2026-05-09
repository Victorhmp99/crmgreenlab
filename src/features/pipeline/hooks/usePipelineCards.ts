import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelineCards } from '@/services/pipeline'

export function usePipelineCards() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['pipeline-cards', tenantId],
    queryFn:  () => fetchPipelineCards(tenantId!),
    enabled:  !!tenantId,
  })
}
