import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelines, fetchStagesByPipeline } from '@/services/pipelineManagement'
import type { Pipeline } from '@/services/pipelineManagement'

// Pipelines demo para VITE_DEMO_MODE
export const DEMO_PIPELINES: Pipeline[] = [
  { id: 'pipeline-1', tenant_id: 'demo-tenant-id', name: 'Inbound',  description: null, color: '#6366F1', position: 0, created_at: new Date().toISOString() },
  { id: 'pipeline-2', tenant_id: 'demo-tenant-id', name: 'Outbound', description: null, color: '#10B981', position: 1, created_at: new Date().toISOString() },
]

export function usePipelines() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const isDemo   = import.meta.env.VITE_DEMO_MODE === 'true'

  return useQuery({
    queryKey:  ['pipelines', tenantId],
    queryFn:   isDemo ? () => DEMO_PIPELINES : () => fetchPipelines(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}

export function usePipelineStagesByPipeline(pipelineId: string | null) {
  const tenantId = useAuthStore((s) => s.tenant?.id)

  return useQuery({
    queryKey:  ['pipeline-stages', tenantId, pipelineId],
    queryFn:   () => fetchStagesByPipeline(tenantId!, pipelineId!),
    enabled:   !!tenantId && !!pipelineId,
    staleTime: 1000 * 60 * 2,
  })
}
