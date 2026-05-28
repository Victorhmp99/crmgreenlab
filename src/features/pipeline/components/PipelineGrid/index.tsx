import { useState, useRef, useEffect } from 'react'
import { Plus, MoreHorizontal, Users, LayoutList, Calendar, ArrowRight, Pencil, Trash2, Check, X, TrendingUp } from 'lucide-react'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import { PipelineCreationWizard } from '../PipelineCreationWizard'
import { DeletePipelineModal } from '../DeletePipelineModal'
import { formatCurrencyCompact } from '@/lib/utils'
import type { Pipeline } from '@/services/pipelineManagement'
import type { PipelineStage } from '@/types'
import type { KanbanCardData } from '@/services/pipeline'

// ── Cores predefinidas ────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#00e676','#40a0ff','#a78bfa','#fbbf24',
  '#ec4899','#ff4444','#14B8A6','#f97316',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

function pipelineStats(
  pipelineId: string,
  allStages:  PipelineStage[],
  allCards:   KanbanCardData[],
) {
  const stages     = allStages.filter((s) => s.pipeline_id === pipelineId)
  const stageIds   = new Set(stages.map((s) => s.id))
  const pipeCards  = allCards.filter((c) => stageIds.has(c.card.stage_id))
  const leadCount  = pipeCards.length
  const totalValue = pipeCards.reduce((sum, c) => sum + (Number(c.lead.value) || 0), 0)
  return { stageCount: stages.length, leadCount, totalValue }
}

// ── Menu de contexto por card ─────────────────────────────────────────────────

function PipelineCardMenu({
  pipeline,
  anchorRef,
  onClose,
}: {
  pipeline:  Pipeline
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose:   () => void
}) {
  const { renamePipeline, removePipeline } = usePipelineManagement()
  const [editing,        setEditing]        = useState(false)
  const [name,           setName]           = useState(pipeline.name)
  const [color,          setColor]          = useState(pipeline.color)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const menuRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  async function handleSave() {
    if (!name.trim()) return
    await renamePipeline.mutateAsync({ id: pipeline.id, name: name.trim(), color })
    onClose()
  }

  async function handleDelete() {
    await removePipeline.mutateAsync(pipeline.id)
    onClose()
  }

  return (
    <div ref={menuRef}
      className="absolute right-0 top-8 z-50 rounded-xl"
      style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
        minWidth: editing ? 220 : 150,
      }}
      onClick={(e) => e.stopPropagation()}>

      {editing ? (
        <div className="p-3 flex flex-col gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full h-8 rounded-lg px-2 text-sm focus:outline-none"
            style={{ background: '#111', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className="h-5 w-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#e8e8e8' : 'transparent',
                  transform:   color === c ? 'scale(1.2)' : undefined,
                }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 h-7 rounded-lg text-xs flex items-center justify-center gap-1"
              style={{ border: '1px solid #2a2a2a', color: '#666' }}>
              <X size={10} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={!name.trim() || renamePipeline.isPending}
              className="flex-1 h-7 rounded-lg text-xs text-black flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: 'var(--tenant-primary)' }}>
              <Check size={10} /> Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="py-1">
          <button onClick={() => setEditing(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{ color: '#aaa' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <Pencil size={13} /> Renomear
          </button>
          <button onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{ color: '#ff4444' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,68,68,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      )}

      {showDeleteModal && (
        <DeletePipelineModal
          pipelineName={pipeline.name}
          isPending={removePipeline.isPending}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

// CreatePipelineModal substituído pelo PipelineCreationWizard (importado acima)

// ── Card de pipeline ──────────────────────────────────────────────────────────

function PipelineCard({
  pipeline,
  allStages,
  allCards,
  onSelect,
}: {
  pipeline:  Pipeline
  allStages: PipelineStage[]
  allCards:  KanbanCardData[]
  onSelect:  (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const { stageCount, leadCount, totalValue } = pipelineStats(pipeline.id, allStages, allCards)

  return (
    <div
      className="relative flex flex-col rounded-2xl transition-all cursor-pointer group"
      style={{
        background: '#141414',
        border: '1px solid #222',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        minHeight: 160,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = `1px solid ${pipeline.color}40`
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.4)`
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = '1px solid #222'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'
      }}
    >
      {/* Barra colorida superior */}
      <div className="h-1 w-full rounded-t-2xl" style={{ background: pipeline.color }} />

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-tight" style={{ color: '#e8e8e8' }}>
            {pipeline.name}
          </h3>
          <div className="relative shrink-0">
            <button
              ref={menuBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v) }}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
              style={{ color: '#555' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#aaa'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
              }}>
              <MoreHorizontal size={15} />
            </button>
            {showMenu && (
              <PipelineCardMenu
                pipeline={pipeline}
                anchorRef={menuBtnRef}
                onClose={() => setShowMenu(false)}
              />
            )}
          </div>
        </div>

        {/* Badges de stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2a2a2a' }}>
            <Users size={11} style={{ color: pipeline.color }} />
            {leadCount} Lead{leadCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2a2a2a' }}>
            <LayoutList size={11} style={{ color: pipeline.color }} />
            {stageCount} Etapa{stageCount !== 1 ? 's' : ''}
          </span>
          {totalValue > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2a2a2a' }}>
              <TrendingUp size={11} style={{ color: pipeline.color }} />
              Valor da Pipeline {formatCurrencyCompact(totalValue)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: '#444' }}>
            <Calendar size={10} />
            {formatDate(pipeline.created_at)}
          </span>
          <button
            onClick={() => onSelect(pipeline.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black transition-all"
            style={{ background: pipeline.color }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
            Acessar
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Grid principal ────────────────────────────────────────────────────────────

interface PipelineGridProps {
  pipelines: Pipeline[]
  allStages: PipelineStage[]
  allCards:  KanbanCardData[]
  isLoading: boolean
  onSelect:  (id: string) => void
}

export function PipelineGrid({ pipelines, allStages, allCards, isLoading, onSelect }: PipelineGridProps) {
  const [showWizard, setShowWizard] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#2a2a2a', borderTopColor: 'var(--tenant-primary)' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>Pipelines</h1>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>
            Gerencie seus funis e acompanhe o progresso dos leads
          </p>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {/* Card de criar nova pipeline */}
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-3 rounded-2xl p-5 transition-all text-left"
          style={{
            background: '#111',
            border: '2px dashed #2a2a2a',
            minHeight: 160,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.border = '2px dashed var(--tenant-primary)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(var(--tenant-primary-rgb,0,230,118),0.03)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.border = '2px dashed #2a2a2a'
            ;(e.currentTarget as HTMLButtonElement).style.background = '#111'
          }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--tenant-primary)' }}>
            <Plus size={20} className="text-black" />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#aaa' }}>
            Criar nova Pipeline
          </span>
        </button>

        {/* Cards das pipelines existentes */}
        {pipelines.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            allStages={allStages}
            allCards={allCards}
            onSelect={onSelect}
          />
        ))}
      </div>

      {showWizard && (
        <PipelineCreationWizard
          onClose={() => setShowWizard(false)}
          onCreated={(id) => { setShowWizard(false); onSelect(id) }}
        />
      )}
    </div>
  )
}
