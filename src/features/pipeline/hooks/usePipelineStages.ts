import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelineStages } from '@/services/pipeline'

export function usePipelineStages() {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey: ['pipeline-stages', tenantId],
    queryFn:  () => fetchPipelineStages(tenantId!),
    enabled:  !!tenantId,
    staleTime: 1000 * 60 * 5, // etapas mudam raramente
  })
}
