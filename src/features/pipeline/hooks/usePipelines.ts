import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelines, fetchStagesByPipeline, fetchAllStages } from '@/services/pipelineManagement'
import type { Pipeline } from '@/services/pipelineManagement'
import type { PipelineStage } from '@/types'

// Pipelines demo para VITE_DEMO_MODE
export const DEMO_PIPELINES: Pipeline[] = [
  { id: 'pipeline-1', tenant_id: 'demo-tenant-id', name: 'Inbound',  description: null, color: '#6366F1', position: 0, start_stage_id: 'stage-1', webhook_field_keys: null, created_at: new Date().toISOString() },
  { id: 'pipeline-2', tenant_id: 'demo-tenant-id', name: 'Outbound', description: null, color: '#10B981', position: 1, start_stage_id: 'stage-5', webhook_field_keys: null, created_at: new Date().toISOString() },
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

/** Todas as etapas do tenant — usado para calcular stats por pipeline no grid */
export function useAllPipelineStages() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const isDemo   = import.meta.env.VITE_DEMO_MODE === 'true'

  const demoAll: PipelineStage[] = [
    { id: 'stage-1', tenant_id: 'demo', name: 'Novo Lead',    color: '#6366F1', position: 0, is_final: false, pipeline_id: 'pipeline-1', created_at: '' } as PipelineStage,
    { id: 'stage-2', tenant_id: 'demo', name: 'Contatado',    color: '#3B82F6', position: 1, is_final: false, pipeline_id: 'pipeline-1', created_at: '' } as PipelineStage,
    { id: 'stage-3', tenant_id: 'demo', name: 'Agendado',     color: '#F59E0B', position: 2, is_final: false, pipeline_id: 'pipeline-1', created_at: '' } as PipelineStage,
    { id: 'stage-4', tenant_id: 'demo', name: 'Fechado',      color: '#10B981', position: 3, is_final: true,  pipeline_id: 'pipeline-1', created_at: '' } as PipelineStage,
    { id: 'stage-5', tenant_id: 'demo', name: 'Prospectando', color: '#8B5CF6', position: 0, is_final: false, pipeline_id: 'pipeline-2', created_at: '' } as PipelineStage,
    { id: 'stage-6', tenant_id: 'demo', name: 'Qualificado',  color: '#EC4899', position: 1, is_final: false, pipeline_id: 'pipeline-2', created_at: '' } as PipelineStage,
    { id: 'stage-7', tenant_id: 'demo', name: 'Proposta',     color: '#F59E0B', position: 2, is_final: false, pipeline_id: 'pipeline-2', created_at: '' } as PipelineStage,
    { id: 'stage-8', tenant_id: 'demo', name: 'Ganho',        color: '#10B981', position: 3, is_final: true,  pipeline_id: 'pipeline-2', created_at: '' } as PipelineStage,
  ]

  return useQuery({
    queryKey:  ['all-pipeline-stages', tenantId],
    queryFn:   isDemo ? () => demoAll : () => fetchAllStages(tenantId!),
    enabled:   !!tenantId || isDemo,
    staleTime: 1000 * 60 * 2,
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
