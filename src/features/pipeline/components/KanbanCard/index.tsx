import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import type { KanbanCardData } from '@/services/pipeline'

interface KanbanCardProps {
  data: KanbanCardData
  onRemove: (cardId: string) => void
  isDraggingOverlay?: boolean
}

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function KanbanCard({ data, onRemove, isDraggingOverlay = false }: KanbanCardProps) {
  const { card, lead } = data

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', cardData: data } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const days = daysAgo(card.moved_at)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border bg-white p-3.5 shadow-sm',
        'select-none transition-shadow',
        isDragging && !isDraggingOverlay
          ? 'opacity-40 shadow-none border-dashed border-slate-300'
          : 'border-slate-200 hover:shadow-md hover:border-slate-300',
        isDraggingOverlay && 'shadow-xl rotate-1 border-blue-200 ring-2 ring-blue-200',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
      >
        <GripVertical size={14} />
      </div>

      {/* Conteúdo do card */}
      <div className="pl-3">
        {/* Nome */}
        <p className="font-semibold text-slate-900 text-sm leading-tight truncate pr-5">
          {lead.name}
        </p>

        {/* Telefone */}
        {lead.phone && (
          <div className="flex items-center gap-1 mt-1.5">
            <Phone size={11} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{formatPhone(lead.phone)}</span>
          </div>
        )}

        {/* Origem + tempo na etapa */}
        <div className="flex items-center justify-between mt-2.5">
          <LeadSourceBadge source={lead.source} />
          <span className={cn(
            'text-[10px] font-medium rounded-full px-1.5 py-0.5',
            days > 7
              ? 'bg-red-50 text-red-500'
              : days > 3
              ? 'bg-amber-50 text-amber-600'
              : 'bg-slate-100 text-slate-500',
          )}>
            {days === 0 ? 'hoje' : `${days}d`}
          </span>
        </div>

        {/* Tags */}
        {lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                {tag}
              </span>
            ))}
            {lead.tags.length > 3 && (
              <span className="text-[10px] text-slate-400">+{lead.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Botão remover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(card.id) }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50"
        title="Remover do pipeline"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// Versão estática usada no DragOverlay (sem hooks de sortable)
export function KanbanCardOverlay({ data }: { data: KanbanCardData }) {
  return <KanbanCard data={data} onRemove={() => {}} isDraggingOverlay />
}
