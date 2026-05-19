import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Trash2, Check, X, Trophy, XCircle, Activity } from 'lucide-react'
import { cn, formatCurrencyCompact } from '@/lib/utils'
import { KanbanCard } from '../KanbanCard'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import { useFunnelSteps } from '@/features/funnel/hooks/useFunnelSteps'
import { Select } from '@/components/ui/Select'
import type { ColumnData } from '@/services/pipeline'
import type { Lead, StageType } from '@/types'

const STAGE_TYPE_CONFIG: Record<StageType, { label: string; icon: React.ElementType; color: string }> = {
  in_progress: { label: 'Em andamento', icon: Activity, color: '#666'    },
  won:         { label: 'Ganho',        icon: Trophy,   color: '#00e676' },
  lost:        { label: 'Perdido',      icon: XCircle,  color: '#ff4444' },
}

const PRESET_COLORS = [
  '#00e676','#40a0ff','#a78bfa','#fbbf24',
  '#ec4899','#ff4444','#14B8A6','#f97316',
]

interface KanbanColumnProps {
  column:             ColumnData
  pipelineId:         string
  isOver:             boolean
  onRemoveCard:       (cardId: string) => void
  onAddLead:          (stageId: string) => void
  onSelectLead:       (lead: Lead) => void
  isDraggingOverlay?: boolean
}

export function KanbanColumn({
  column, pipelineId, isOver, onRemoveCard, onAddLead, onSelectLead, isDraggingOverlay = false,
}: KanbanColumnProps) {
  const { stage, cards } = column
  const { editStage, removeStage } = usePipelineManagement()

  const [editing,    setEditing]    = useState(false)
  const [stageName,  setStageName]  = useState(stage.name)
  const [stageColor, setStageColor] = useState(stage.color)
  const [stageType,  setStageType]  = useState<StageType>(stage.stage_type ?? 'in_progress')
  const [funnelStepId, setFunnelStepId] = useState<string>(stage.funnel_step_id ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: funnelSteps = [] } = useFunnelSteps()

  // Soma dos valores dos leads na coluna
  const columnValue = cards.reduce((sum, c) => sum + Number(c.lead.value ?? 0), 0)
  const typeConfig  = STAGE_TYPE_CONFIG[stage.stage_type ?? 'in_progress']

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const {
    attributes, listeners, setNodeRef: setColumnRef,
    transform, transition, isDragging: isColumnDragging,
  } = useSortable({
    id:   `col-${stage.id}`,
    data: { type: 'column', stageId: stage.id },
  })

  const { setNodeRef: setDropRef } = useDroppable({
    id:   stage.id,
    data: { type: 'column', stageId: stage.id },
  })

  const cardIds = cards.map((c) => c.card.id)

  async function handleSaveStage() {
    if (!stageName.trim()) return
    await editStage.mutateAsync({
      id: stage.id, pipelineId,
      data: {
        name:           stageName.trim(),
        color:          stageColor,
        stage_type:     stageType,
        funnel_step_id: funnelStepId || null,
      },
    })
    setEditing(false)
  }

  async function handleDeleteStage() {
    if (cards.length > 0) {
      if (!confirm(`A etapa "${stage.name}" tem ${cards.length} lead(s). Remover os leads desta etapa também?`)) return
    } else {
      if (!confirm(`Excluir etapa "${stage.name}"?`)) return
    }
    await removeStage.mutateAsync({ id: stage.id, pipelineId })
  }

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setColumnRef}
      style={style}
      className={cn('flex flex-col w-72 shrink-0 transition-opacity', isColumnDragging && !isDraggingOverlay && 'opacity-40')}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1 group">
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: '#444' }}
          title="Arrastar coluna"
        >
          <GripVertical size={14} />
        </div>

        {editing ? (
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveStage()
                if (e.key === 'Escape') { setStageName(stage.name); setStageColor(stage.color); setEditing(false) }
              }}
              className="h-7 w-full rounded-lg px-2 text-sm font-medium focus:outline-none"
              style={{ background: '#1a1a1a', border: '1px solid var(--tenant-primary)', color: '#e8e8e8' }}
            />
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageColor(c)}
                    className="h-4 w-4 rounded-full border-2 transition-transform"
                    style={{ backgroundColor: c, borderColor: stageColor === c ? '#e8e8e8' : 'transparent', transform: stageColor === c ? 'scale(1.25)' : undefined }}
                  />
                ))}
              </div>
              <div className="ml-auto flex gap-1">
                <button onClick={() => { setStageName(stage.name); setStageColor(stage.color); setStageType(stage.stage_type ?? 'in_progress'); setEditing(false) }}
                  className="h-6 w-6 rounded flex items-center justify-center transition-colors"
                  style={{ color: '#555' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <X size={12} />
                </button>
                <button onClick={handleSaveStage} disabled={!stageName.trim() || editStage.isPending}
                  className="h-6 w-6 rounded flex items-center justify-center transition-colors disabled:opacity-40"
                  style={{ color: 'var(--tenant-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,230,118,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <Check size={12} />
                </button>
              </div>
            </div>

            {/* Seletor de tipo de etapa */}
            <div className="flex gap-1 mt-1">
              {(['in_progress', 'won', 'lost'] as StageType[]).map((t) => {
                const cfg = STAGE_TYPE_CONFIG[t]
                const Icon = cfg.icon
                return (
                  <button
                    key={t}
                    onClick={() => setStageType(t)}
                    className="flex-1 flex items-center justify-center gap-1 h-6 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: stageType === t ? `${cfg.color}22` : 'transparent',
                      border:     stageType === t ? `1px solid ${cfg.color}` : '1px solid #2a2a2a',
                      color:      stageType === t ? cfg.color : '#666',
                    }}
                  >
                    <Icon size={10} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            {/* Mapeamento para passo do funil */}
            {funnelSteps.length > 0 && (
              <div className="mt-1">
                <Select
                  value={funnelStepId}
                  onChange={(e) => setFunnelStepId(e.target.value)}
                  options={[
                    { value: '', label: '— sem passo do funil —' },
                    ...funnelSteps.map((fs) => ({ value: fs.id, label: `${fs.position + 1}. ${fs.name}` })),
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            <button
              onClick={() => setEditing(true)}
              className="flex-1 text-left text-sm font-semibold truncate transition-colors flex items-center gap-1.5"
              style={{ color: '#e8e8e8' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#e8e8e8')}
              title={`Tipo: ${typeConfig.label} · Clique para editar`}
            >
              <span className="truncate">{stage.name}</span>
              {stage.stage_type && stage.stage_type !== 'in_progress' && (
                <typeConfig.icon size={11} className="shrink-0" style={{ color: typeConfig.color }} />
              )}
            </button>
            {columnValue > 0 && (
              <span className="text-[10px] font-semibold tabular-nums shrink-0"
                style={{ color: typeConfig.color }}>
                {formatCurrencyCompact(columnValue)}
              </span>
            )}
            <span className="text-xs font-medium rounded-full px-2 py-0.5 tabular-nums"
              style={{ background: '#1e1e1e', color: '#666' }}>
              {cards.length}
            </span>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onAddLead(stage.id)}
                className="h-6 w-6 rounded flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.1)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#555'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                title="Adicionar lead">
                <Plus size={13} />
              </button>
              <button onClick={handleDeleteStage}
                className="h-6 w-6 rounded flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.1)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#555'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                title="Excluir etapa">
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Área droppável — tamanho fixo da coluna, scroll interno se passar */}
      <div
        ref={setDropRef}
        className="flex flex-col gap-2.5 flex-1 rounded-xl p-2 min-h-32 transition-all overflow-y-auto"
        style={{
          background: isOver ? 'rgba(0,230,118,0.05)' : '#0d0d0d',
          border: isOver ? '2px dashed rgba(0,230,118,0.3)' : '1px solid #1a1a1a',
        }}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((cardData) => (
            <KanbanCard
              key={cardData.card.id}
              data={cardData}
              onRemove={onRemoveCard}
              onSelect={onSelectLead}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && !editing && (
          <button
            onClick={() => onAddLead(stage.id)}
            className="flex-1 flex items-center justify-center rounded-lg py-6 gap-1.5 text-xs transition-all"
            style={{
              border: isOver ? '2px dashed rgba(0,230,118,0.4)' : '2px dashed #1e1e1e',
              color: '#444',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,230,118,0.3)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#444'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = isOver ? 'rgba(0,230,118,0.4)' : '#1e1e1e'
            }}
          >
            <Plus size={13} /> Adicionar lead
          </button>
        )}
      </div>
    </div>
  )
}

export function KanbanColumnOverlay({ column }: { column: ColumnData }) {
  return (
    <div className="flex flex-col w-72 shrink-0 opacity-90">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.stage.color }} />
        <span className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>{column.stage.name}</span>
        <span className="text-xs rounded-full px-2 py-0.5" style={{ background: '#1e1e1e', color: '#666' }}>
          {column.cards.length}
        </span>
      </div>
      <div className="rounded-xl p-2 flex flex-col gap-2 min-h-20" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        {column.cards.slice(0, 3).map((c) => (
          <div key={c.card.id} className="h-14 rounded-xl opacity-50" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
        ))}
      </div>
    </div>
  )
}
