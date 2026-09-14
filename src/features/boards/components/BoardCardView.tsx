import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarClock, CheckSquare, MessageSquare, UserRound, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardData, Membro } from '@/services/boards'
import type { BoardLabel } from '@/types'
import { Avatar, hojeLocal, prazoCurto } from './comum'

interface Props {
  card:     CardData
  labels:   BoardLabel[]
  membros:  Membro[]
  onOpen:   (card: CardData) => void
  onToggleDone?: (card: CardData) => void
  overlay?: boolean
}

export function BoardCardView({ card, labels, membros, onOpen, onToggleDone, overlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id, data: { type: 'card', card },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const hoje      = hojeLocal()
  const concluido = !!card.completed_at
  const atrasado  = !concluido && !!card.due_date && card.due_date < hoje
  const eHoje     = !concluido && card.due_date === hoje
  const etiquetas = labels.filter((l) => card.labelIds.includes(l.id))

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      className={cn(
        'rounded-lg cursor-pointer select-none transition-shadow overflow-hidden',
        isDragging && !overlay && 'opacity-40',
        overlay && 'shadow-2xl rotate-[1.5deg]',
      )}
      // `touchAction: none` no card inteiro brigava com o scroll no celular —
      // o sensor de toque já exige segurar 220ms, então deixa o toque rolar.
    >
      {/* Concluído fica verde — o "check que eu dou" que o Victor pediu, sem depender da coluna. */}
      <div className="rounded-lg" style={concluido
        ? { background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.35)' }
        : { background: '#161616', border: '1px solid #242424' }}>
        {card.color && <div className="h-1.5 rounded-t-lg" style={{ background: card.color }} />}
        <div className="p-2.5 flex flex-col gap-2">
          {etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {etiquetas.map((l) => (
                <span key={l.id} className="text-[10px] font-medium rounded px-1.5 py-0.5 leading-tight"
                  style={{ background: `${l.color}26`, color: l.color }}>{l.name}</span>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2">
            {onToggleDone && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleDone(card) }}
                onPointerDown={(e) => e.stopPropagation()}
                title={concluido ? 'Reabrir' : 'Marcar como feito'}
                className="mt-0.5 h-4 w-4 rounded-full shrink-0 flex items-center justify-center transition-colors"
                style={concluido
                  ? { background: '#00e676', color: '#000', border: '1px solid #00e676' }
                  : { border: '1px solid #444', color: 'transparent' }}
                onMouseEnter={(e) => { if (!concluido) { e.currentTarget.style.borderColor = '#00e676'; e.currentTarget.style.color = '#00e676' } }}
                onMouseLeave={(e) => { if (!concluido) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = 'transparent' } }}>
                <Check size={10} strokeWidth={3} />
              </button>
            )}
            <p className={cn('text-sm leading-snug flex-1', concluido && 'line-through')}
               style={{ color: concluido ? '#7fbf9a' : '#e8e8e8' }}>{card.title}</p>
          </div>

          {(card.due_date || card.checklistTotal > 0 || card.commentCount > 0 || card.leadName || card.assignees.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: '#666' }}>
              {card.due_date && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                  style={atrasado ? { background: 'rgba(255,68,68,0.12)', color: '#ff4444' }
                       : eHoje    ? { background: 'rgba(255,187,0,0.12)', color: '#ffbb00' }
                       : concluido ? { background: 'rgba(0,230,118,0.10)', color: '#00e676' } : {}}>
                  <CalendarClock size={11} /> {prazoCurto(card.due_date)}
                </span>
              )}
              {card.checklistTotal > 0 && (
                <span className="inline-flex items-center gap-1"
                  style={card.checklistDone === card.checklistTotal ? { color: '#00e676' } : {}}>
                  <CheckSquare size={11} /> {card.checklistDone}/{card.checklistTotal}
                </span>
              )}
              {card.commentCount > 0 && (
                <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {card.commentCount}</span>
              )}
              {card.leadName && (
                <span className="inline-flex items-center gap-1 truncate max-w-[9rem]" style={{ color: '#40a0ff' }}>
                  <UserRound size={11} /> {card.leadName}
                </span>
              )}
              {card.assignees.length > 0 && (
                <span className="ml-auto flex -space-x-1.5">
                  {card.assignees.slice(0, 3).map((uid) => (
                    <Avatar key={uid} id={uid} membro={membros.find((m) => m.user_id === uid)} size={20} />
                  ))}
                  {card.assignees.length > 3 && (
                    <span className="inline-flex items-center justify-center rounded-full text-[9px]"
                      style={{ width: 20, height: 20, background: '#222', color: '#888' }}>+{card.assignees.length - 3}</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
