import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanbanCard } from '../KanbanCard'
import type { ColumnData } from '@/services/pipeline'

interface KanbanColumnProps {
  column: ColumnData
  isOver: boolean
  onRemoveCard: (cardId: string) => void
  onAddLead: (stageId: string) => void
}

export function KanbanColumn({ column, isOver, onRemoveCard, onAddLead }: KanbanColumnProps) {
  const { stage, cards } = column

  const { setNodeRef } = useDroppable({
    id:   stage.id,
    data: { type: 'column', stageId: stage.id },
  })

  const cardIds = cards.map((c) => c.card.id)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Header da coluna */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          {/* Indicador de cor da etapa */}
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-sm text-slate-700">{stage.name}</h3>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 tabular-nums">
            {cards.length}
          </span>
        </div>

        <button
          onClick={() => onAddLead(stage.id)}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title={`Adicionar lead em "${stage.name}"`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Área droppável */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2.5 flex-1 rounded-xl p-2 min-h-32 transition-colors',
          isOver
            ? 'bg-blue-50 ring-2 ring-blue-200 ring-dashed'
            : 'bg-slate-100/60',
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((cardData) => (
            <KanbanCard
              key={cardData.card.id}
              data={cardData}
              onRemove={onRemoveCard}
            />
          ))}
        </SortableContext>

        {/* Estado vazio */}
        {cards.length === 0 && (
          <div className={cn(
            'flex-1 flex items-center justify-center rounded-lg border-2 border-dashed py-6',
            isOver ? 'border-blue-300 bg-blue-50' : 'border-slate-200',
          )}>
            <p className="text-xs text-slate-400">Solte aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
