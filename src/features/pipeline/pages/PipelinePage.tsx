import { useState } from 'react'
import { ArrowLeft, Settings, RefreshCw } from 'lucide-react'
import { KanbanBoard } from '../components/KanbanBoard'
import { PipelineGrid } from '../components/PipelineGrid'
import { PipelineToolsPanel } from '../components/PipelineToolsPanel'
import { PipelineAutomationsModal } from '../components/PipelineAutomationsModal'
import { QuickAddLeadModal } from '../components/QuickAddLeadModal'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { LeadForm } from '@/features/leads/components/LeadForm'
import { ImportModal } from '@/features/leads/components/ImportModal'
import { ExportModal } from '@/features/leads/components/ExportModal'
import { usePipelines, usePipelineStagesByPipeline, useAllPipelineStages } from '../hooks/usePipelines'
import { usePipelineCards } from '../hooks/usePipelineCards'
import { usePipelineMutations } from '../hooks/usePipelineMutations'
import { Spinner } from '@/components/ui/Spinner'
import type { Lead } from '@/types'

// ── Dados demo ────────────────────────────────────────────────────────────────
import type { KanbanCardData } from '@/services/pipeline'
import type { PipelineStage } from '@/types'

const DEMO_STAGES_MAP: Record<string, PipelineStage[]> = {
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

const DEMO_CARDS_MAP: Record<string, KanbanCardData[]> = {
  'pipeline-1': [
    { card: { id: 'card-1', tenant_id: 'demo', lead_id: 'l1', stage_id: 'stage-1', position: 0, moved_at: new Date(Date.now() - 2*86400000).toISOString(), moved_by: null }, lead: { id: 'l1', tenant_id: 'demo', assigned_to: null, name: 'Ana Costa',     phone: '11991234567', email: 'ana@email.com',  status: 'active', source: 'meta_ads', source_campaign: 'Black Friday', notes: null, tags: ['implante'],    custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
    { card: { id: 'card-2', tenant_id: 'demo', lead_id: 'l2', stage_id: 'stage-2', position: 0, moved_at: new Date(Date.now() - 5*86400000).toISOString(), moved_by: null }, lead: { id: 'l2', tenant_id: 'demo', assigned_to: null, name: 'Carlos Mendes', phone: '11982345678', email: null,            status: 'active', source: 'referral', source_campaign: null,           notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
  ],
  'pipeline-2': [
    { card: { id: 'card-4', tenant_id: 'demo', lead_id: 'l4', stage_id: 'stage-6', position: 0, moved_at: new Date(Date.now() - 1*86400000).toISOString(), moved_by: null }, lead: { id: 'l4', tenant_id: 'demo', assigned_to: null, name: 'Roberto Souza', phone: '11964567890', email: null,            status: 'active', source: 'manual',   source_campaign: null,           notes: null, tags: [],             custom_fields: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
  ],
}

// ── Componente principal ──────────────────────────────────────────────────────

type View = 'grid' | 'board'

export function PipelinePage() {
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

  // ── Estado de navegação ───────────────────────────────────────────────────
  const [view,               setView]               = useState<View>('grid')
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  // ── Estado de modais ──────────────────────────────────────────────────────
  const [showTools,       setShowTools]       = useState(false)
  const [showAutomations, setShowAutomations] = useState(false)
  const [showImport,      setShowImport]      = useState(false)
  const [showExport,      setShowExport]      = useState(false)
  const [addToStage,      setAddToStage]      = useState<{ id: string; name: string; position: number } | null>(null)
  const [selectedLead,    setSelectedLead]    = useState<Lead | null>(null)
  const [editingLead,     setEditingLead]     = useState<Lead | null | undefined>(undefined)
  const [confirmRemove,   setConfirmRemove]   = useState<{ cardId: string; leadName: string } | null>(null)
  const [removeError,     setRemoveError]     = useState<string | null>(null)

  // ── Dados ─────────────────────────────────────────────────────────────────
  const { data: pipelines = [],  isLoading: pipelinesLoading } = usePipelines()
  const { data: allStages = [] }                                = useAllPipelineStages()
  const { data: allCards  = [],  refetch: refetchCards }        = usePipelineCards()

  const { data: fetchedStages = [], isLoading: stagesLoading, refetch: refetchStages } =
    usePipelineStagesByPipeline(isDemo ? null : selectedPipelineId)

  const stages = isDemo && selectedPipelineId
    ? (DEMO_STAGES_MAP[selectedPipelineId] ?? [])
    : fetchedStages

  const cards = isDemo && selectedPipelineId
    ? (DEMO_CARDS_MAP[selectedPipelineId] ?? []).filter((c) =>
        stages.some((s) => s.id === c.card.stage_id))
    : allCards.filter((c) => stages.some((s) => s.id === c.card.stage_id))

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) ?? null

  const { remove } = usePipelineMutations()

  // ── Navegação ─────────────────────────────────────────────────────────────
  function handleSelectPipeline(id: string) {
    setSelectedPipelineId(id)
    setView('board')
    setShowTools(false)
  }

  function handleBack() {
    setView('grid')
    setSelectedPipelineId(null)
    setShowTools(false)
    setShowAutomations(false)
  }

  // ── Handlers do board ─────────────────────────────────────────────────────
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

  function handleDeletePipeline() {
    if (!selectedPipeline) return
    if (!confirm(`Excluir pipeline "${selectedPipeline.name}"? Todos os cards serão removidos.`)) return
    import('@/services/pipelineManagement').then(({ deletePipeline }) => {
      deletePipeline(selectedPipeline.id).then(() => {
        handleBack()
      })
    })
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  if (view === 'grid') {
    return (
      <PipelineGrid
        pipelines={pipelines}
        allStages={allStages}
        allCards={allCards}
        isLoading={pipelinesLoading}
        onSelect={handleSelectPipeline}
      />
    )
  }

  // ── Board view ────────────────────────────────────────────────────────────
  const isLoading = stagesLoading

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">

      {/* ── Toolbar do board ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {/* Esquerda: voltar + nome da pipeline */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm transition-colors shrink-0"
            style={{ border: '1px solid #2a2a2a', color: '#666' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#666'
            }}>
            <ArrowLeft size={13} />
            Pipelines
          </button>

          {selectedPipeline && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: selectedPipeline.color }} />
              <h2 className="text-sm font-bold truncate" style={{ color: '#e8e8e8' }}>
                {selectedPipeline.name}
              </h2>
            </div>
          )}
        </div>

        {/* Direita: ações */}
        <div className="flex items-center gap-2 shrink-0">
          {/* ⚙️ Ferramentas */}
          <button
            onClick={() => setShowTools(true)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-all"
            style={{ border: '1px solid #2a2a2a', color: '#888' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8e8'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a3a'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#888'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'
            }}
            title="Ferramentas da pipeline">
            <Settings size={14} />
            Ferramentas
          </button>

          {/* + Novo Lead */}
          {stages.length > 0 && (
            <button
              onClick={handleAddLeadHeader}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-black text-sm font-medium transition-colors"
              style={{ background: 'var(--tenant-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
              + Novo Lead
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ border: '1px solid #2a2a2a', color: '#555' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
            }}
            title="Atualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Subtítulo */}
      {selectedPipelineId && !pipelinesLoading && (
        <p className="text-xs -mt-1 shrink-0" style={{ color: '#444' }}>
          {cards.length} lead{cards.length !== 1 ? 's' : ''} ·{' '}
          {stages.length} etapa{stages.length !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: '#555' }}>arraste para reorganizar · clique para editar</span>
        </p>
      )}

      {/* ── Kanban ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
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
                onRemoveCard={(cardId) => {
                  const card = cards.find((c) => c.card.id === cardId)
                  setConfirmRemove({ cardId, leadName: card?.lead.name ?? 'lead' })
                }}
                onSelectLead={setSelectedLead}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Painel de ferramentas ─────────────────────────────────────────── */}
      <PipelineToolsPanel
        open={showTools}
        onClose={() => setShowTools(false)}
        pipeline={selectedPipeline}
        stages={stages}
        onOpenAutomations={() => setShowAutomations(true)}
        onImport={() => setShowImport(true)}
        onExport={() => setShowExport(true)}
        onDelete={handleDeletePipeline}
      />

      {/* ── Automações ───────────────────────────────────────────────────── */}
      {selectedPipeline && (
        <PipelineAutomationsModal
          open={showAutomations}
          onClose={() => setShowAutomations(false)}
          pipelineId={selectedPipeline.id}
          pipelineName={selectedPipeline.name}
          stages={stages}
          startStageId={selectedPipeline.start_stage_id ?? null}
        />
      )}

      {/* ── Importar / Exportar ───────────────────────────────────────────── */}
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* ── QuickAdd + Drawer + LeadForm ──────────────────────────────────── */}
      <QuickAddLeadModal
        stageId={addToStage?.id ?? null}
        stageName={addToStage?.name}
        stagePosition={addToStage?.position ?? 0}
        onClose={() => setAddToStage(null)}
      />

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead) }}
      />

      <LeadForm
        open={editingLead !== undefined}
        onClose={() => setEditingLead(undefined)}
        lead={editingLead ?? null}
      />

      {/* ── Confirmação remover card ──────────────────────────────────────── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !remove.isPending && setConfirmRemove(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#141414', border: '1px solid #2a2a2a' }}>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: '#fbbf24' }}>
                Retirar da pipeline?
              </h3>
              <p className="text-sm mt-1" style={{ color: '#aaa' }}>
                Você está prestes a remover <strong style={{ color: '#e8e8e8' }}>{confirmRemove.leadName}</strong> desta pipeline.
              </p>
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                O lead <strong>não</strong> será excluído — apenas sai desta pipeline.
              </p>
            </div>
            {removeError && (
              <p className="text-sm rounded-lg px-3 py-2"
                style={{ color: '#ff4444', background: 'rgba(255,68,68,0.1)' }}>
                {removeError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemove(null)} disabled={remove.isPending}
                className="rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40"
                style={{ color: '#aaa', border: '1px solid #2a2a2a' }}>
                Cancelar
              </button>
              <button
                disabled={remove.isPending}
                onClick={async () => {
                  setRemoveError(null)
                  try {
                    await remove.mutateAsync(confirmRemove.cardId)
                    setConfirmRemove(null)
                  } catch (err) {
                    setRemoveError((err as Error).message ?? 'Erro ao remover')
                  }
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>
                {remove.isPending ? 'Removendo...' : 'Retirar da pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
