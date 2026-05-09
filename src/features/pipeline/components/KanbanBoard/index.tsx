import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { KanbanColumn, KanbanColumnOverlay } from '../KanbanColumn'
import { KanbanCardOverlay } from '../KanbanCard'
import { usePipelineMutations } from '../../hooks/usePipelineMutations'
import { usePipelineManagement } from '../../hooks/usePipelineManagement'
import type { KanbanCardData, ColumnData } from '@/services/pipeline'
import type { PipelineStage, Lead } from '@/types'

interface KanbanBoardProps {
  stages:       PipelineStage[]
  cards:        KanbanCardData[]
  pipelineId:   string
  onAddLead:    (stageId: string) => void
  onRemoveCard: (cardId: string) => void
  onSelectLead: (lead: Lead) => void
}

function buildColumns(stages: PipelineStage[], cards: KanbanCardData[]): ColumnData[] {
  const byStage = new Map<string, KanbanCardData[]>()
  stages.forEach((s) => byStage.set(s.id, []))
  cards.forEach((c) => {
    const col = byStage.get(c.card.stage_id)
    if (col) col.push(c)
  })
  return stages.map((stage) => ({ stage, cards: byStage.get(stage.id) ?? [] }))
}

function findColByCardId(columns: ColumnData[], cardId: string): ColumnData | undefined {
  return columns.find((col) => col.cards.some((c) => c.card.id === cardId))
}

export function KanbanBoard({ stages, cards, pipelineId, onAddLead, onRemoveCard, onSelectLead }: KanbanBoardProps) {
  const { move, reorder } = usePipelineMutations()
  const { reorderStages }  = usePipelineManagement()

  const [localColumns,  setLocalColumns]  = useState<ColumnData[] | null>(null)
  const [localStages,   setLocalStages]   = useState<PipelineStage[] | null>(null)
  const [activeCard,    setActiveCard]    = useState<KanbanCardData | null>(null)
  const [activeColumn,  setActiveColumn]  = useState<ColumnData | null>(null)
  const [overColumnId,  setOverColumnId]  = useState<string | null>(null)

  const displayStages  = localStages  ?? stages
  const displayColumns = localColumns ?? buildColumns(displayStages, cards)

  // IDs das colunas para o SortableContext horizontal
  const columnSortIds = displayStages.map((s) => `col-${s.id}`)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const type = event.active.data.current?.type as string
    if (type === 'column') {
      const stageId  = (event.active.id as string).replace('col-', '')
      const colData  = buildColumns(stages, cards).find((c) => c.stage.id === stageId)
      setActiveColumn(colData ?? null)
      setLocalStages([...stages])
      setLocalColumns(buildColumns(stages, cards))
    } else {
      const cardData = event.active.data.current?.cardData as KanbanCardData
      setActiveCard(cardData ?? null)
      setLocalColumns(buildColumns(stages, cards))
    }
  }, [stages, cards])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) { setOverColumnId(null); return }

    const activeId = active.id  as string
    const overId   = over.id    as string
    const type     = active.data.current?.type as string

    if (type === 'column') {
      // Reordena colunas em tempo real
      const activeIdx = displayStages.findIndex((s) => `col-${s.id}` === activeId)
      const overIdx   = displayStages.findIndex((s) => `col-${s.id}` === overId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        const reordered = arrayMove([...(localStages ?? stages)], activeIdx, overIdx)
        setLocalStages(reordered)
        setLocalColumns(buildColumns(reordered, cards))
      }
      return
    }

    // Movimentação de cards
    setLocalColumns((prev) => {
      const cols = prev ?? buildColumns(stages, cards)
      const sourceCol = findColByCardId(cols, activeId)
      const destCol   = cols.find((c) => c.stage.id === overId)
        ?? findColByCardId(cols, overId)

      if (!sourceCol || !destCol) return cols
      setOverColumnId(destCol.stage.id)

      if (sourceCol.stage.id === destCol.stage.id) {
        const oldIdx = sourceCol.cards.findIndex((c) => c.card.id === activeId)
        const newIdx = destCol.cards.findIndex((c)  => c.card.id === overId)
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return cols
        const reordered = arrayMove(sourceCol.cards, oldIdx, newIdx)
        return cols.map((col) =>
          col.stage.id === sourceCol.stage.id ? { ...col, cards: reordered } : col,
        )
      }

      const movingCard = sourceCol.cards.find((c) => c.card.id === activeId)
      if (!movingCard) return cols
      const updated = { ...movingCard, card: { ...movingCard.card, stage_id: destCol.stage.id } }

      return cols.map((col) => {
        if (col.stage.id === sourceCol.stage.id)
          return { ...col, cards: col.cards.filter((c) => c.card.id !== activeId) }
        if (col.stage.id === destCol.stage.id) {
          const overIdx   = col.cards.findIndex((c) => c.card.id === overId)
          const insertAt  = overIdx === -1 ? col.cards.length : overIdx
          const newCards  = [...col.cards]
          newCards.splice(insertAt, 0, updated)
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }, [stages, cards, displayStages, localStages])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event
    const type = active.data.current?.type as string

    setActiveCard(null)
    setActiveColumn(null)
    setOverColumnId(null)

    if (type === 'column' && localStages) {
      // Persiste nova ordem das colunas
      const updates = localStages.map((s, i) => ({ id: s.id, position: i }))
      reorderStages.mutate({ updates, pipelineId })
      setLocalStages(null)
      setLocalColumns(null)
      return
    }

    if (!localColumns) return

    const { over } = event
    if (!over) { setLocalColumns(null); return }

    const activeId  = active.id as string
    const overId    = over.id   as string

    const sourceCol = findColByCardId(localColumns, activeId)
    const destCol   = localColumns.find((c) => c.stage.id === overId)
      ?? findColByCardId(localColumns, overId)

    if (!sourceCol || !destCol) { setLocalColumns(null); return }

    const finalCol      = localColumns.find((c) => c.stage.id === destCol.stage.id)!
    const finalPosition = finalCol.cards.findIndex((c) => c.card.id === activeId)
    const movedCard     = finalCol.cards.find((c) => c.card.id === activeId)
      ?? sourceCol.cards.find((c) => c.card.id === activeId)

    if (!movedCard) { setLocalColumns(null); return }

    if (sourceCol.stage.id !== destCol.stage.id) {
      move.mutate({
        cardId:        activeId,
        newStageId:    destCol.stage.id,
        newPosition:   finalPosition,
        fromStageName: sourceCol.stage.name,
        toStageName:   destCol.stage.name,
        leadId:        movedCard.lead.id,
      })
    } else {
      const serverCol = buildColumns(stages, cards).find((c) => c.stage.id === sourceCol.stage.id)
      const serverIdx = serverCol?.cards.findIndex((c) => c.card.id === activeId) ?? -1
      if (serverIdx !== finalPosition) {
        reorder.mutate(finalCol.cards.map((c, i) => ({ id: c.card.id, position: i })))
      } else {
        setLocalColumns(null)
      }
    }
  }, [localColumns, localStages, stages, cards, pipelineId, move, reorder, reorderStages])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* SortableContext horizontal para colunas */}
      <SortableContext items={columnSortIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 h-full pb-4">
          {displayColumns.map((column) => (
            <KanbanColumn
              key={column.stage.id}
              column={column}
              pipelineId={pipelineId}
              isOver={overColumnId === column.stage.id}
              onRemoveCard={onRemoveCard}
              onAddLead={onAddLead}
              onSelectLead={onSelectLead}
            />
          ))}

          {/* Botão para adicionar nova etapa */}
          <AddStageButton pipelineId={pipelineId} nextPosition={displayStages.length} />
        </div>
      </SortableContext>

      {/* Overlay durante drag */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeCard    && <KanbanCardOverlay   data={activeCard} />}
        {activeColumn  && <KanbanColumnOverlay column={activeColumn} />}
      </DragOverlay>
    </DndContext>
  )
}

// Botão "+ Nova Etapa" no final do board
function AddStageButton({ pipelineId, nextPosition }: { pipelineId: string; nextPosition: number }) {
  const [adding, setAdding]   = useState(false)
  const [name,   setName]     = useState('')
  const [color,  setColor]    = useState('#94a3b8')
  const { addStage }          = usePipelineManagement()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const COLORS = ['#6366F1','#3B82F6','#10B981','#F59E0B','#EC4899','#EF4444','#94a3b8']

  async function handleAdd() {
    if (!name.trim()) return
    await addStage.mutateAsync({ pipelineId, name: name.trim(), color, position: nextPosition })
    setName('')
    setColor('#94a3b8')
    setAdding(false)
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="shrink-0 flex flex-col items-center justify-center w-52 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-colors gap-1.5 py-6"
      >
        <Plus size={18} />
        <span className="text-xs font-medium">Nova etapa</span>
      </button>
    )
  }

  return (
    <div className="shrink-0 w-52 rounded-xl border-2 border-blue-300 bg-blue-50 p-3 flex flex-col gap-2">
      <input
        ref={(el) => { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; el?.focus() }}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
        placeholder="Nome da etapa..."
        className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      <div className="flex gap-1.5 flex-wrap">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)}
            className={`h-4 w-4 rounded-full border-2 transition-transform ${color === c ? 'border-slate-600 scale-125' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setAdding(false)} className="flex-1 h-7 rounded-lg text-xs border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={handleAdd} disabled={!name.trim() || addStage.isPending}
          className="flex-1 h-7 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          Adicionar
        </button>
      </div>
    </div>
  )
}
