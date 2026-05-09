import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Trash2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanbanCard } from '../KanbanCard'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import type { ColumnData } from '@/services/pipeline'
import type { Lead } from '@/types'

const PRESET_COLORS = [
  '#6366F1','#3B82F6','#10B981','#F59E0B',
  '#EC4899','#EF4444','#8B5CF6','#14B8A6',
]

interface KanbanColumnProps {
  column:        ColumnData
  pipelineId:    string
  isOver:        boolean
  onRemoveCard:  (cardId: string) => void
  onAddLead:     (stageId: string) => void
  onSelectLead:  (lead: Lead) => void
  isDraggingOverlay?: boolean
}

export function KanbanColumn({
  column, pipelineId, isOver, onRemoveCard, onAddLead, onSelectLead, isDraggingOverlay = false,
}: KanbanColumnProps) {
  const { stage, cards } = column
  const { editStage, removeStage } = usePipelineManagement()

  // ── Estado de edição inline ───────────────────────────────────────────────
  const [editing,   setEditing]   = useState(false)
  const [stageName, setStageName] = useState(stage.name)
  const [stageColor,setStageColor]= useState(stage.color)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  // ── Sortable (para arrastar a coluna) ─────────────────────────────────────
  const {
    attributes,
    listeners,
    setNodeRef: setColumnRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id:   `col-${stage.id}`,
    data: { type: 'column', stageId: stage.id },
  })

  // ── Droppable (para receber cards) ────────────────────────────────────────
  const { setNodeRef: setDropRef } = useDroppable({
    id:   stage.id,
    data: { type: 'column', stageId: stage.id },
  })

  const cardIds = cards.map((c) => c.card.id)

  async function handleSaveStage() {
    if (!stageName.trim()) return
    await editStage.mutateAsync({
      id: stage.id,
      pipelineId,
      data: { name: stageName.trim(), color: stageColor },
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

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setColumnRef}
      style={style}
      className={cn(
        'flex flex-col w-72 shrink-0 transition-opacity',
        isColumnDragging && !isDraggingOverlay && 'opacity-40',
      )}
    >
      {/* ── Header da coluna ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1 group">
        {/* Drag handle da coluna */}
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
          title="Arrastar coluna"
        >
          <GripVertical size={14} />
        </div>

        {editing ? (
          /* Edição inline */
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              ref={inputRef}
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveStage()
                if (e.key === 'Escape') { setStageName(stage.name); setStageColor(stage.color); setEditing(false) }
              }}
              className="h-7 w-full rounded-lg border border-blue-400 px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageColor(c)}
                    className={cn('h-4 w-4 rounded-full border-2 transition-transform', stageColor === c ? 'border-slate-600 scale-125' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="ml-auto flex gap-1">
                <button onClick={() => { setStageName(stage.name); setStageColor(stage.color); setEditing(false) }}
                  className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X size={12} />
                </button>
                <button onClick={handleSaveStage} disabled={!stageName.trim() || editStage.isPending}
                  className="h-6 w-6 rounded flex items-center justify-center text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                  <Check size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Exibição normal */
          <>
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            <button
              onClick={() => setEditing(true)}
              className="flex-1 text-left text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors truncate"
              title="Clique para renomear"
            >
              {stage.name}
            </button>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 tabular-nums">
              {cards.length}
            </span>

            {/* Ações que aparecem no hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onAddLead(stage.id)}
                className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Adicionar lead">
                <Plus size={13} />
              </button>
              <button onClick={handleDeleteStage}
                className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Excluir etapa">
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Área droppável para cards ─────────────────────────────────────── */}
      <div
        ref={setDropRef}
        className={cn(
          'flex flex-col gap-2.5 flex-1 rounded-xl p-2 min-h-32 transition-colors',
          isOver ? 'bg-blue-50 ring-2 ring-blue-200 ring-dashed' : 'bg-slate-100/60',
        )}
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
            className={cn(
              'flex-1 flex items-center justify-center rounded-lg border-2 border-dashed py-6 gap-1.5',
              'text-xs text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-colors',
              isOver ? 'border-blue-300 bg-blue-50' : 'border-slate-200',
            )}
          >
            <Plus size={13} /> Adicionar lead
          </button>
        )}
      </div>
    </div>
  )
}

// Versão estática para DragOverlay
export function KanbanColumnOverlay({ column }: { column: ColumnData }) {
  return (
    <div className="flex flex-col w-72 shrink-0 opacity-90">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.stage.color }} />
        <span className="text-sm font-semibold text-slate-700">{column.stage.name}</span>
        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{column.cards.length}</span>
      </div>
      <div className="rounded-xl bg-slate-100/80 p-2 flex flex-col gap-2 min-h-20">
        {column.cards.slice(0, 3).map((c) => (
          <div key={c.card.id} className="h-14 rounded-xl bg-white border border-slate-200 opacity-70" />
        ))}
      </div>
    </div>
  )
}
