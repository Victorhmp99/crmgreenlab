import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelineStages } from '@/services/pipeline'
import type { PipelineStage } from '@/types'

// Etapas demo usadas quando VITE_DEMO_MODE=true
const DEMO_STAGES: PipelineStage[] = [
  { id: 'stage-1', tenant_id: 'demo-tenant-id', name: 'Novo Lead',     color: '#6366F1', position: 0, is_final: false, created_at: new Date().toISOString() },
  { id: 'stage-2', tenant_id: 'demo-tenant-id', name: 'Contato Feito', color: '#3B82F6', position: 1, is_final: false, created_at: new Date().toISOString() },
  { id: 'stage-3', tenant_id: 'demo-tenant-id', name: 'Agendado',      color: '#F59E0B', position: 2, is_final: false, created_at: new Date().toISOString() },
  { id: 'stage-4', tenant_id: 'demo-tenant-id', name: 'Em Negociação', color: '#EC4899', position: 3, is_final: false, created_at: new Date().toISOString() },
  { id: 'stage-5', tenant_id: 'demo-tenant-id', name: 'Fechado',       color: '#10B981', position: 4, is_final: true,  created_at: new Date().toISOString() },
]

export function usePipelineStages() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const isDemo   = import.meta.env.VITE_DEMO_MODE === 'true'

  return useQuery({
    queryKey:  ['pipeline-stages', tenantId],
    queryFn:   isDemo ? () => DEMO_STAGES : () => fetchPipelineStages(tenantId!),
    enabled:   !!tenantId,
    staleTime: 1000 * 60 * 5,
  })
}
