import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { KanbanBoard } from '../components/KanbanBoard'
import { PipelineSelector } from '../components/PipelineSelector'
import { QuickAddLeadModal } from '../components/QuickAddLeadModal'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { LeadForm } from '@/features/leads/components/LeadForm'
import { usePipelines, usePipelineStagesByPipeline } from '../hooks/usePipelines'
import { usePipelineCards } from '../hooks/usePipelineCards'
import { usePipelineMutations } from '../hooks/usePipelineMutations'
import { Spinner } from '@/components/ui/Spinner'
import type { Lead } from '@/types'

// Demo cards por pipeline
const DEMO_CARDS_MAP: Record<string, import('@/services/pipeline').KanbanCardData[]> = {
  'pipeline-1': [
    { card: { id: 'card-1', tenant_id: 'demo', lead_id: 'l1', stage_id: 'stage-1', position: 0, moved_at: new Date(Date.now() - 2*86400000).toISOString(), moved_by: null }, lead: { id: 'l1', tenant_id: 'demo', assigned_to: null, name: 'Ana Costa',     phone: '11991234567', email: 'ana@email.com',  status: 'active', source: 'meta_ads', source_campaign: 'Black Friday', notes: null, tags: ['implante'],    custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
    { card: { id: 'card-2', tenant_id: 'demo', lead_id: 'l2', stage_id: 'stage-2', position: 0, moved_at: new Date(Date.now() - 5*86400000).toISOString(), moved_by: null }, lead: { id: 'l2', tenant_id: 'demo', assigned_to: null, name: 'Carlos Mendes', phone: '11982345678', email: null,            status: 'active', source: 'referral', source_campaign: null,           notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
    { card: { id: 'card-3', tenant_id: 'demo', lead_id: 'l3', stage_id: 'stage-3', position: 0, moved_at: new Date(Date.now() - 8*86400000).toISOString(), moved_by: null }, lead: { id: 'l3', tenant_id: 'demo', assigned_to: null, name: 'Fernanda Lima', phone: '11973456789', email: 'fe@email.com', status: 'active', source: 'google',   source_campaign: 'Clareamento',  notes: null, tags: ['clareamento'], custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
  ],
  'pipeline-2': [
    { card: { id: 'card-4', tenant_id: 'demo', lead_id: 'l4', stage_id: 'stage-6', position: 0, moved_at: new Date(Date.now() - 1*86400000).toISOString(), moved_by: null }, lead: { id: 'l4', tenant_id: 'demo', assigned_to: null, name: 'Roberto Souza', phone: '11964567890', email: null,            status: 'active', source: 'manual',   source_campaign: null,           notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
  ],
}

const DEMO_STAGES_MAP: Record<string, import('@/types').PipelineStage[]> = {
  'pipeline-1': [
    { id: 'stage-1', tenant_id: 'demo', name: 'Novo Lead',     color: '#6366F1', position: 0, is_final: false, created_at: '' },
    { id: 'stage-2', tenant_id: 'demo', name: 'Contatado',     color: '#3B82F6', position: 1, is_final: false, created_at: '' },
    { id: 'stage-3', tenant_id: 'demo', name: 'Agendado',      color: '#F59E0B', position: 2, is_final: false, created_at: '' },
    { id: 'stage-4', tenant_id: 'demo', name: 'Fechado',       color: '#10B981', position: 3, is_final: true,  created_at: '' },
  ],
  'pipeline-2': [
    { id: 'stage-5', tenant_id: 'demo', name: 'Prospectando',  color: '#8B5CF6', position: 0, is_final: false, created_at: '' },
    { id: 'stage-6', tenant_id: 'demo', name: 'Qualificado',   color: '#EC4899', position: 1, is_final: false, created_at: '' },
    { id: 'stage-7', tenant_id: 'demo', name: 'Proposta',      color: '#F59E0B', position: 2, is_final: false, created_at: '' },
    { id: 'stage-8', tenant_id: 'demo', name: 'Ganho',         color: '#10B981', position: 3, is_final: true,  created_at: '' },
  ],
}

export function PipelinePage() {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  // Seleciona automaticamente o primeiro pipeline ao carregar
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id)
    }
  }, [pipelines, selectedPipelineId])

  // Stages e cards do pipeline selecionado
  const { data: fetchedStages = [], isLoading: stagesLoading, refetch: refetchStages } =
    usePipelineStagesByPipeline(isDemo ? null : selectedPipelineId)

  const { data: fetchedCards = [], isLoading: cardsLoading, refetch: refetchCards } =
    usePipelineCards()

  // Em modo demo usa dados locais; em produção usa Supabase
  const stages = isDemo && selectedPipelineId
    ? (DEMO_STAGES_MAP[selectedPipelineId] ?? [])
    : fetchedStages

  const cards = isDemo && selectedPipelineId
    ? (DEMO_CARDS_MAP[selectedPipelineId] ?? []).filter((c) =>
        stages.some((s) => s.id === c.card.stage_id),
      )
    : fetchedCards.filter((c) =>
        stages.some((s) => s.id === c.card.stage_id),
      )

  const { remove } = usePipelineMutations()

  // Modais
  const [addToStage,    setAddToStage]    = useState<{ id: string; name: string; position: number } | null>(null)
  const [selectedLead,  setSelectedLead]  = useState<Lead | null>(null)
  const [editingLead,   setEditingLead]   = useState<Lead | null | undefined>(undefined)

  const isLoading = pipelinesLoading || stagesLoading || cardsLoading

  function handleAddLead(stageId: string) {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return
    const count = cards.filter((c) => c.card.stage_id === stageId).length
    setAddToStage({ id: stageId, name: stage.name, position: count })
  }

  function handleAddLeadHeader() {
    const first = stages[0]
    if (!first) return
    const count = cards.filter((c) => c.card.stage_id === first.id).length
    setAddToStage({ id: first.id, name: first.name, position: count })
  }

  function handleRefresh() {
    refetchStages()
    refetchCards()
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* ── Seletor de pipelines ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex-1 min-w-0">
          {pipelinesLoading ? (
            <div className="flex gap-2">
              {[1,2].map((i) => <div key={i} className="h-9 w-24 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : (
            <PipelineSelector
              pipelines={pipelines}
              selectedId={selectedPipelineId}
              onSelect={(id) => setSelectedPipelineId(id)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {stages.length > 0 && (
            <button
              onClick={handleAddLeadHeader}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Novo Lead
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Subtítulo */}
      {selectedPipelineId && !pipelinesLoading && (
        <p className="text-xs text-slate-400 -mt-2 shrink-0">
          {cards.length} lead{cards.length !== 1 ? 's' : ''} no funil ·{' '}
          {stages.length} etapa{stages.length !== 1 ? 's' : ''} ·{' '}
          <span className="text-slate-500">arraste para reorganizar · clique para editar</span>
        </p>
      )}

      {/* ── Board ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : !selectedPipelineId ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center text-slate-400">
          <p className="text-sm">Selecione ou crie um pipeline acima para começar</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="h-full min-h-[500px]">
            {selectedPipelineId && (
              <KanbanBoard
                stages={stages}
                cards={cards}
                pipelineId={selectedPipelineId}
                onAddLead={handleAddLead}
                onRemoveCard={(cardId) => remove.mutate(cardId)}
                onSelectLead={setSelectedLead}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Modais ────────────────────────────────────────────────────────── */}
      <QuickAddLeadModal
        stageId={addToStage?.id ?? null}
        stageName={addToStage?.name}
        stagePosition={addToStage?.position ?? 0}
        onClose={() => setAddToStage(null)}
      />

      {/* Drawer de detalhes + histórico do lead (abre ao clicar no card) */}
      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead) }}
      />

      {/* Formulário de edição completo do lead */}
      <LeadForm
        open={editingLead !== undefined}
        onClose={() => setEditingLead(undefined)}
        lead={editingLead ?? null}
      />
    </div>
  )
}
