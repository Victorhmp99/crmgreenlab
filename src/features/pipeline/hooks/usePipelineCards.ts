import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { fetchPipelineCards } from '@/services/pipeline'
import type { KanbanCardData } from '@/services/pipeline'

// Cards demo usados quando VITE_DEMO_MODE=true
const DEMO_CARDS: KanbanCardData[] = [
  {
    card: { id: 'card-1', tenant_id: 'demo-tenant-id', lead_id: 'l1', stage_id: 'stage-1', position: 0, moved_at: new Date(Date.now() - 2 * 86400000).toISOString(), moved_by: null },
    lead: { id: 'l1', tenant_id: 'demo-tenant-id', assigned_to: null, name: 'Ana Costa',     phone: '11991234567', email: 'ana@email.com',  status: 'active', source: 'meta_ads', source_campaign: 'Black Friday', notes: null, tags: ['implante'],    custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    card: { id: 'card-2', tenant_id: 'demo-tenant-id', lead_id: 'l2', stage_id: 'stage-1', position: 1, moved_at: new Date(Date.now() - 1 * 86400000).toISOString(), moved_by: null },
    lead: { id: 'l2', tenant_id: 'demo-tenant-id', assigned_to: null, name: 'Carlos Mendes', phone: '11982345678', email: null,            status: 'active', source: 'referral', source_campaign: null,            notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    card: { id: 'card-3', tenant_id: 'demo-tenant-id', lead_id: 'l3', stage_id: 'stage-2', position: 0, moved_at: new Date(Date.now() - 3 * 86400000).toISOString(), moved_by: null },
    lead: { id: 'l3', tenant_id: 'demo-tenant-id', assigned_to: null, name: 'Fernanda Lima', phone: '11973456789', email: 'fe@email.com', status: 'active', source: 'google',   source_campaign: 'Clareamento',  notes: null, tags: ['clareamento'], custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    card: { id: 'card-4', tenant_id: 'demo-tenant-id', lead_id: 'l4', stage_id: 'stage-3', position: 0, moved_at: new Date(Date.now() - 5 * 86400000).toISOString(), moved_by: null },
    lead: { id: 'l4', tenant_id: 'demo-tenant-id', assigned_to: null, name: 'Roberto Souza', phone: '11964567890', email: null,            status: 'active', source: 'manual',   source_campaign: null,           notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
  {
    card: { id: 'card-5', tenant_id: 'demo-tenant-id', lead_id: 'l5', stage_id: 'stage-4', position: 0, moved_at: new Date(Date.now() - 8 * 86400000).toISOString(), moved_by: null },
    lead: { id: 'l5', tenant_id: 'demo-tenant-id', assigned_to: null, name: 'Juliana Ramos', phone: '11955678901', email: 'ju@email.com', status: 'active', source: 'meta_ads', source_campaign: 'Verão',         notes: null, tags: ['ortodontia'], custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  },
]

export function usePipelineCards() {
  const tenantId = useAuthStore((s) => s.tenant?.id)
  const isDemo   = import.meta.env.VITE_DEMO_MODE === 'true'

  return useQuery({
    queryKey: ['pipeline-cards', tenantId],
    queryFn:  isDemo ? () => DEMO_CARDS : () => fetchPipelineCards(tenantId!),
    enabled:  !!tenantId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}
