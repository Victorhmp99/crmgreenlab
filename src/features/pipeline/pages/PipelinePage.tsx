import { useState, useEffect, useRef} from 'react'
import { ArrowLeft, Settings, RefreshCw, Pencil, Search } from 'lucide-react'
import { KanbanBoard } from '../components/KanbanBoard'
import { PipelineGrid } from '../components/PipelineGrid'
import { PipelineToolsPanel } from '../components/PipelineToolsPanel'
import { DuplicatasModal } from '@/features/leads/components/DuplicatasModal'
import { useTelaCompacta } from '@/hooks/useTelaCompacta'
import { RegrasMovimentacaoModal } from '../components/RegrasMovimentacaoModal'
import { PipelineCreationWizard } from '../components/PipelineCreationWizard'
import { DeletePipelineModal } from '../components/DeletePipelineModal'
import { PipelineAutomationsModal } from '../components/PipelineAutomationsModal'
import { QuickAddLeadModal } from '../components/QuickAddLeadModal'
import { PipelineSearchPopover } from '../components/PipelineSearchPopover'
import { LeadDrawer } from '@/features/activities/components/LeadDrawer'
import { LeadForm } from '@/features/leads/components/LeadForm'
import { ImportModal } from '@/features/leads/components/ImportModal'
import { ExportModal } from '@/features/leads/components/ExportModal'
import { usePipelines, usePipelineStagesByPipeline, useAllPipelineStages } from '../hooks/usePipelines'
import { usePipelineCards } from '../hooks/usePipelineCards'
import { usePipelineMutations } from '../hooks/usePipelineMutations'
import { usePipelineManagement } from '../hooks/usePipelineManagement'
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
  // Sempre entra pela GRADE (lista de pipelines + criar). Antes o board era
  // reaberto a partir do sessionStorage, o que abria um board vazio quando a
  // seleção era de uma pipeline apagada ou de outra empresa (após trocar).
  const [view,               setView]               = useState<View>('grid')
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  // ── Estado de modais ──────────────────────────────────────────────────────
  const [showDuplicatas, setShowDuplicatas] = useState(false)
  const areaQuadroRef = useRef<HTMLDivElement>(null)
  const telaCompacta  = useTelaCompacta()

  /* No celular cabe UMA coluna na tela. Sem um atalho, descobrir que existem
     outras exige arrastar o quadro pro lado no escuro — e foi por isso que a
     pipeline "não deixava explorar". Aqui as etapas viram fichas: dá pra ver
     quantas são, quantos leads tem cada uma, e pular direto. */
  function irParaEtapa(indice: number) {
    const area   = areaQuadroRef.current
    const trilho = area?.querySelector<HTMLElement>('.flex.gap-4')
    const alvo   = trilho?.children[indice] as HTMLElement | undefined
    if (!area || !trilho || !alvo) return

    /* Posição calculada e salto direto, sem `behavior: 'smooth'`.
       A rolagem suave é ignorada em parte dos navegadores — e quando é, não
       avisa: não lança erro, simplesmente não anda. O recurso inteiro parecia
       quebrado por causa disso. Salto instantâneo funciona em todo lugar, e
       num celular ir direto pra etapa é melhor que esperar animação. */
    area.scrollLeft = alvo.offsetLeft - trilho.offsetLeft
  }
  const [showRegras,     setShowRegras]     = useState(false)
  const [showTools,            setShowTools]            = useState(false)
  const [showAutomations,      setShowAutomations]      = useState(false)
  const [showEditWizard,       setShowEditWizard]       = useState(false)
  const [showDeletePipeline,   setShowDeletePipeline]   = useState(false)
  const [showImport,           setShowImport]           = useState(false)
  const [showExport,           setShowExport]           = useState(false)
  const [successMsg,           setSuccessMsg]           = useState<string | null>(null)
  const [addToStage,      setAddToStage]      = useState<{ id: string; name: string; position: number } | null>(null)
  const [selectedLead,    setSelectedLead]    = useState<Lead | null>(null)
  const [editingLead,     setEditingLead]     = useState<Lead | null | undefined>(undefined)
  const [confirmRemove,   setConfirmRemove]   = useState<{ cardId: string; leadName: string } | null>(null)
  const [removeError,     setRemoveError]     = useState<string | null>(null)
  const [refreshing,      setRefreshing]      = useState(false)
  const [showSearch,      setShowSearch]      = useState(false)

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
  const { removePipeline } = usePipelineManagement()

  // Limpa qualquer seleção antiga persistida (de versões anteriores que
  // reabriam o board sozinho) — evita cair num board vazio ao abrir a página.
  useEffect(() => {
    sessionStorage.removeItem('selectedPipelineId')
  }, [])

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

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.all([refetchStages(), refetchCards()])
      setSuccessMsg('Pipeline atualizada')
      setTimeout(() => setSuccessMsg(null), 2000)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDeletePipeline() {
    if (!selectedPipeline) return
    const name = selectedPipeline.name
    await removePipeline.mutateAsync(selectedPipeline.id)
    setShowDeletePipeline(false)
    handleBack()
    setSuccessMsg(`Pipeline "${name}" excluída com sucesso.`)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  if (view === 'grid') {
    return (
      <div className="relative">
        <PipelineGrid
          pipelines={pipelines}
          allStages={allStages}
          allCards={allCards}
          isLoading={pipelinesLoading}
          onSelect={handleSelectPipeline}
        />

        {/* Toast de sucesso */}
        {successMsg && (
          <div
            className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl"
            style={{
              background:  'rgba(0,230,118,0.12)',
              border:      '1px solid rgba(0,230,118,0.3)',
              color:       '#00e676',
              backdropFilter: 'blur(8px)',
              animation:   'fadeIn 0.2s ease',
            }}
          >
            <span className="text-base">✓</span>
            {successMsg}
          </div>
        )}
      </div>
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
        {/* Sem `flex-wrap` os quatro botoes somavam mais que a largura do
            celular e o ultimo saia da tela — inalcancavel, porque a barra nao
            rola. Deixar quebrar linha custa altura e resolve. */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
          {/* 🔍 Buscar lead */}
          <div className="relative">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1px solid ${showSearch ? '#3a3a3a' : '#2a2a2a'}`,
                color: showSearch ? '#e8e8e8' : '#888',
                background: showSearch ? '#1a1a1a' : 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8e8'
              }}
              onMouseLeave={(e) => {
                if (showSearch) return
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#888'
              }}
              title="Buscar lead nas pipelines">
              <Search size={14} />
              <span className="hidden sm:inline">Buscar</span>
            </button>
            <PipelineSearchPopover
              open={showSearch}
              onClose={() => setShowSearch(false)}
              currentPipelineId={selectedPipelineId}
              allCards={allCards}
              allStages={allStages}
              pipelines={pipelines}
              onOpenLead={(lead) => setSelectedLead(lead)}
              onGoToPipeline={(id) => { setSelectedPipelineId(id); setView('board') }}
            />
          </div>

          {/* ✏️ Editar Pipeline */}
          <button
            onClick={() => setShowEditWizard(true)}
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
            title="Editar pipeline">
            <Pencil size={14} />
            <span className="hidden sm:inline">Editar</span>
          </button>

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
            <span className="hidden sm:inline">Ferramentas</span>
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
            disabled={refreshing}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-60"
            style={{ border: '1px solid #2a2a2a', color: refreshing ? 'var(--tenant-primary)' : '#555' }}
            onMouseEnter={(e) => {
              if (refreshing) return
              ;(e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              if (refreshing) return
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
            }}
            title="Atualizar">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Subtítulo */}
      {selectedPipelineId && !pipelinesLoading && (
        <p className="text-xs -mt-1 shrink-0" style={{ color: '#444' }}>
          {cards.length} lead{cards.length !== 1 ? 's' : ''} ·{' '}
          {stages.length} etapa{stages.length !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: '#555' }}>
            <span className="hidden md:inline">arraste pela alça para mover · clique para abrir</span>
            {/* Curto de proposito: a versao longa quebrava em duas linhas e
                custava 18px de altura numa tela que ja esta apertada. */}
            <span className="md:hidden">segure a alça ⋮ para mover</span>
          </span>
        </p>
      )}

      {/* ── Kanban ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
        {telaCompacta && stages.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 shrink-0" style={{ scrollbarWidth: 'none' }}>
            {stages.map((etapa, i) => {
              const quantos = cards.filter((c) => c.card.stage_id === etapa.id).length
              return (
                <button
                  key={etapa.id}
                  type="button"
                  onClick={() => irParaEtapa(i)}
                  className="flex items-center gap-1.5 shrink-0 rounded-full pl-2 pr-2.5 py-1 text-[11px] transition-colors"
                  style={{ background: '#161616', border: '1px solid #242424', color: '#bbb' }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: etapa.color ?? '#555' }} />
                  <span className="max-w-[8.5rem] truncate">{etapa.name}</span>
                  <span className="tabular-nums" style={{ color: quantos ? '#00e676' : '#555' }}>
                    {quantos}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div ref={areaQuadroRef} className="flex-1 min-h-0 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'thin' }}>
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
        </>
      )}

      {/* ── Painel de ferramentas ─────────────────────────────────────────── */}
      <PipelineToolsPanel
        open={showTools}
        onClose={() => setShowTools(false)}
        pipeline={selectedPipeline}
        stages={stages}
        onOpenAutomations={() => setShowAutomations(true)}
        onEdit={() => setShowEditWizard(true)}
        onImport={() => setShowImport(true)}
        onExport={() => setShowExport(true)}
        onDelete={() => setShowDeletePipeline(true)}
        onDuplicates={() => setShowDuplicatas(true)}
        onRules={() => setShowRegras(true)}
      />

      {selectedPipeline && (
        <RegrasMovimentacaoModal
          open={showRegras}
          onClose={() => setShowRegras(false)}
          pipelineId={selectedPipeline.id}
          pipelineName={selectedPipeline.name}
        />
      )}

      <DuplicatasModal open={showDuplicatas} onClose={() => setShowDuplicatas(false)} />

      {/* ── Automações ───────────────────────────────────────────────────── */}
      {selectedPipeline && (
        <PipelineAutomationsModal
          open={showAutomations}
          onClose={() => setShowAutomations(false)}
          pipelineId={selectedPipeline.id}
          pipelineName={selectedPipeline.name}
          stages={stages}
          startStageId={selectedPipeline.start_stage_id ?? null}
          webhookFieldKeys={selectedPipeline.webhook_field_keys ?? null}
        />
      )}

      {/* ── Importar / Exportar ───────────────────────────────────────────── */}
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* ── Modal de exclusão da pipeline ────────────────────────────────── */}
      {showDeletePipeline && selectedPipeline && (
        <DeletePipelineModal
          pipelineName={selectedPipeline.name}
          isPending={removePipeline.isPending}
          onConfirm={handleDeletePipeline}
          onClose={() => setShowDeletePipeline(false)}
        />
      )}

      {/* ── Wizard de edição da pipeline ──────────────────────────────────── */}
      {showEditWizard && selectedPipeline && (
        <PipelineCreationWizard
          onClose={() => setShowEditWizard(false)}
          onSaved={() => {
            setShowEditWizard(false)
            refetchStages()
            refetchCards()
          }}
          editData={{
            pipeline: {
              id:             selectedPipeline.id,
              name:           selectedPipeline.name,
              color:          selectedPipeline.color,
              start_stage_id: selectedPipeline.start_stage_id ?? null,
            },
            stages,
          }}
        />
      )}

      {/* ── QuickAdd + Drawer + LeadForm ──────────────────────────────────── */}
      <QuickAddLeadModal
        stageId={addToStage?.id ?? null}
        stageName={addToStage?.name}
        stagePosition={addToStage?.position ?? 0}
        pipelineName={selectedPipeline?.name}
        onClose={() => setAddToStage(null)}
      />

      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead) }}
        pipelineName={selectedPipeline?.name}
      />

      <LeadForm
        open={editingLead !== undefined}
        onClose={() => setEditingLead(undefined)}
        lead={editingLead ?? null}
        pipelineName={selectedPipeline?.name}
      />

      {/* Toast de sucesso (board view) */}
      {successMsg && (
        <div
          className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl"
          style={{
            background: 'rgba(0,230,118,0.12)',
            border: '1px solid rgba(0,230,118,0.3)',
            color: '#00e676',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span className="text-base">✓</span>
          {successMsg}
        </div>
      )}

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
