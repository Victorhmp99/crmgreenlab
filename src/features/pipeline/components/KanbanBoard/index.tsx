import { useState, useMemo, useCallback } from 'react'
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
import { arrayMove } from '@dnd-kit/sortable'
import { KanbanColumn } from '../KanbanColumn'
import { KanbanCardOverlay } from '../KanbanCard'
import { usePipelineMutations } from '../../hooks/usePipelineMutations'
import type { KanbanCardData, ColumnData } from '@/services/pipeline'
import type { PipelineStage } from '@/types'

interface KanbanBoardProps {
  stages: PipelineStage[]
  cards: KanbanCardData[]
  onAddLead: (stageId: string) => void
  onRemoveCard: (cardId: string) => void
}

// Constrói o mapa de colunas a partir de stages + cards
function buildColumns(stages: PipelineStage[], cards: KanbanCardData[]): ColumnData[] {
  const cardsByStage = new Map<string, KanbanCardData[]>()
  stages.forEach((s) => cardsByStage.set(s.id, []))
  cards.forEach((c) => {
    const col = cardsByStage.get(c.card.stage_id)
    if (col) col.push(c)
  })
  return stages.map((stage) => ({
    stage,
    cards: cardsByStage.get(stage.id) ?? [],
  }))
}

function findStageByCardId(columns: ColumnData[], cardId: string): ColumnData | undefined {
  return columns.find((col) => col.cards.some((c) => c.card.id === cardId))
}

export function KanbanBoard({ stages, cards, onAddLead, onRemoveCard }: KanbanBoardProps) {
  const { move, reorder } = usePipelineMutations()

  // Estado local para updates otimistas (não espera o refetch do servidor)
  const [localColumns, setLocalColumns] = useState<ColumnData[] | null>(null)
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  // Usa o estado local se existir (otimista), senão usa dados do servidor
  const columns = useMemo(
    () => localColumns ?? buildColumns(stages, cards),
    [localColumns, stages, cards],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const cardData = event.active.data.current?.cardData as KanbanCardData | undefined
    if (cardData) setActiveCard(cardData)
    // Inicializa estado local a partir do estado atual
    setLocalColumns(buildColumns(stages, cards))
  }, [stages, cards])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) { setOverColumnId(null); return }

    const activeId = active.id as string
    const overId   = over.id as string

    setLocalColumns((prev) => {
      const cols = prev ?? buildColumns(stages, cards)

      const sourceCol = findStageByCardId(cols, activeId)
      // O alvo pode ser uma coluna (droppable) ou outro card (sortable dentro de uma coluna)
      const destCol = cols.find((c) => c.stage.id === overId)
        ?? findStageByCardId(cols, overId)

      if (!sourceCol || !destCol) return cols
      setOverColumnId(destCol.stage.id)

      if (sourceCol.stage.id === destCol.stage.id) {
        // Reordenação dentro da mesma coluna
        const oldIndex = sourceCol.cards.findIndex((c) => c.card.id === activeId)
        const newIndex = destCol.cards.findIndex((c) => c.card.id === overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return cols

        const reordered = arrayMove(sourceCol.cards, oldIndex, newIndex)
        return cols.map((col) =>
          col.stage.id === sourceCol.stage.id ? { ...col, cards: reordered } : col,
        )
      }

      // Mover entre colunas diferentes
      const movingCard = sourceCol.cards.find((c) => c.card.id === activeId)
      if (!movingCard) return cols

      const updatedCard: KanbanCardData = {
        ...movingCard,
        card: { ...movingCard.card, stage_id: destCol.stage.id },
      }

      return cols.map((col) => {
        if (col.stage.id === sourceCol.stage.id) {
          return { ...col, cards: col.cards.filter((c) => c.card.id !== activeId) }
        }
        if (col.stage.id === destCol.stage.id) {
          // Insere antes do card alvo, ou no final da coluna
          const overIndex = col.cards.findIndex((c) => c.card.id === overId)
          const insertAt  = overIndex === -1 ? col.cards.length : overIndex
          const newCards  = [...col.cards]
          newCards.splice(insertAt, 0, updatedCard)
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }, [stages, cards])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    setOverColumnId(null)

    if (!over || !localColumns) {
      setLocalColumns(null)
      return
    }

    const activeId = active.id as string
    const overId   = over.id as string

    const sourceCol = findStageByCardId(localColumns, activeId)
    const destCol   = localColumns.find((c) => c.stage.id === overId)
      ?? findStageByCardId(localColumns, overId)

    if (!sourceCol || !destCol) { setLocalColumns(null); return }

    // Determina posição final no estado otimista atual
    const finalCol      = localColumns.find((c) => c.stage.id === destCol.stage.id)!
    const finalPosition = finalCol.cards.findIndex((c) => c.card.id === activeId)
    const movedCard     = sourceCol.cards.find((c) => c.card.id === activeId)
      ?? finalCol.cards.find((c) => c.card.id === activeId)

    if (!movedCard) { setLocalColumns(null); return }

    const stageChanged = sourceCol.stage.id !== destCol.stage.id

    if (stageChanged) {
      move.mutate({
        cardId:        activeId,
        newStageId:    destCol.stage.id,
        newPosition:   finalPosition,
        fromStageName: sourceCol.stage.name,
        toStageName:   destCol.stage.name,
        leadId:        movedCard.lead.id,
      })
    } else {
      // Só reordena dentro da mesma coluna se realmente mudou de índice
      const serverCol = buildColumns(stages, cards).find((c) => c.stage.id === sourceCol.stage.id)
      const serverIdx = serverCol?.cards.findIndex((c) => c.card.id === activeId) ?? -1
      if (serverIdx !== finalPosition) {
        const updates = finalCol.cards.map((c, i) => ({ id: c.card.id, position: i }))
        reorder.mutate(updates)
      } else {
        setLocalColumns(null)
      }
    }
  }, [localColumns, stages, cards, move, reorder])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.stage.id}
            column={column}
            isOver={overColumnId === column.stage.id}
            onRemoveCard={onRemoveCard}
            onAddLead={onAddLead}
          />
        ))}
      </div>

      {/* Card flutuante durante o drag */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeCard && <KanbanCardOverlay data={activeCard} />}
      </DragOverlay>
    </DndContext>
  )
}
