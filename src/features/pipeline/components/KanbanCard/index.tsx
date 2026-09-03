import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, X, GripVertical, DollarSign, Building2 } from 'lucide-react'
import { formatPhone, formatCurrency } from '@/lib/utils'
import { LeadSourceBadge } from '@/features/leads/components/LeadSourceBadge'
import { useTagDefinitions } from '@/features/leads/hooks/useLeadTags'
import type { KanbanCardData } from '@/services/pipeline'
import type { Lead } from '@/types'

interface KanbanCardProps {
  data:               KanbanCardData
  onRemove:           (cardId: string) => void
  onSelect:           (lead: Lead) => void
  isDraggingOverlay?: boolean
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((nDay.getTime() - dDay.getTime()) / 86_400_000)
}

export function KanbanCard({ data, onRemove, onSelect, isDraggingOverlay = false }: KanbanCardProps) {
  const { card, lead } = data
  const { data: tagDefs = [] } = useTagDefinitions()

  // Mapa nome → cor pra colorir os chips de tags do lead
  const colorByName = new Map<string, string>()
  for (const t of tagDefs) colorByName.set(t.name, t.color)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', cardData: data } })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const days  = daysAgo(lead.updated_at)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDraggingOverlay ? '#1e1e1e' : '#1a1a1a',
        border: isDraggingOverlay
          ? '1px solid var(--tenant-primary)'
          : isDragging && !isDraggingOverlay
          ? '1px dashed #333'
          : '1px solid #2a2a2a',
        boxShadow: isDraggingOverlay ? '0 8px 30px rgba(0,0,0,0.6), 0 0 20px rgba(0,230,118,0.1)' : undefined,
        opacity: isDragging && !isDraggingOverlay ? 0.4 : 1,
        transform: isDraggingOverlay ? `${CSS.Transform.toString(transform)} rotate(2deg)` : CSS.Transform.toString(transform),
      }}
      className="group relative rounded-xl select-none transition-all cursor-pointer"
      onMouseEnter={(e) => {
        if (!isDragging) (e.currentTarget as HTMLDivElement).style.borderColor = '#3a3a3a'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isDraggingOverlay ? 'var(--tenant-primary)' : '#2a2a2a'
      }}
      onClick={() => !isDragging && onSelect(lead)}
    >
      {/* Drag handle — faixa de altura total à esquerda.
          No celular fica sempre visível (não há hover) e com touch-action:none
          pra o toque virar arraste (long-press) em vez de rolar a tela. */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 bottom-0 w-7 flex items-center justify-center rounded-l-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
        style={{ color: '#555', touchAction: 'none', background: 'rgba(255,255,255,0.02)' }}
        title="Arraste para mover"
      >
        <GripVertical size={16} />
      </div>

      {/* Conteúdo */}
      {/* Em tela baixa o card vira NOME + TELEFONE (+ valor, quando ha) e mais
          nada. Em celular deitado a coluna tem ~175px pra mostrar lead: com o
          card cheio, de 153px, so cabia um. Assim ele fica em ~50px e cabem
          tres. O que sai daqui continua no card ao tocar nele. */}
      <div className="p-3.5 pl-8 [@media(max-height:520px)]:p-1.5 [@media(max-height:520px)]:pl-7">
        <p className="font-semibold text-sm leading-tight truncate pr-4 [@media(max-height:520px)]:text-[13px]" style={{ color: '#e8e8e8' }}>
          {lead.name}
        </p>

        {lead.company_name && (
          <div className="flex items-center gap-1 mt-0.5 [@media(max-height:520px)]:hidden">
            <Building2 size={11} className="shrink-0" style={{ color: '#555' }} />
            <span className="text-xs truncate" style={{ color: '#888' }}>{lead.company_name}</span>
          </div>
        )}

        {lead.phone && (
          <div className="flex items-center gap-1 mt-1.5 [@media(max-height:520px)]:mt-0.5">
            <Phone size={11} className="shrink-0" style={{ color: '#444' }} />
            <span className="text-xs" style={{ color: '#666' }}>{formatPhone(lead.phone)}</span>
          </div>
        )}

        {lead.value != null && Number(lead.value) > 0 && (
          <div className="flex items-center gap-1 mt-1.5 [@media(max-height:520px)]:mt-0.5">
            <DollarSign size={11} className="shrink-0" style={{ color: '#00e676' }} />
            <span className="text-xs font-semibold tabular-nums" style={{ color: '#00e676' }}>
              {formatCurrency(Number(lead.value))}
            </span>
          </div>
        )}

        {/* Origem e "ha quantos dias" custam uma fileira inteira — 28px dos
            ~80 do card. Em tela baixa isso e metade de um card a mais. */}
        <div className="flex items-center justify-between mt-2.5 [@media(max-height:520px)]:hidden">
          <LeadSourceBadge source={lead.source} />
          <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
            style={
              days > 7  ? { background: 'rgba(255,68,68,0.12)',   color: '#ff4444' } :
              days > 3  ? { background: 'rgba(251,191,36,0.12)',  color: '#fbbf24' } :
                          { background: '#1e1e1e',                 color: '#555'    }
            }>
            {days === 0 ? 'hoje' : `${days}d`}
          </span>
        </div>

        {/* Etiquetas somem em tela baixa: e a linha menos essencial pra
            reconhecer o lead, e vale mais que caiba outro card. */}
        {(lead.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 [@media(max-height:520px)]:hidden">
            {(lead.tags ?? []).slice(0, 3).map((tag) => {
              const color = colorByName.get(tag) ?? '#666'
              return (
                <span key={tag} className="text-[10px] rounded-full px-2 py-0.5"
                  style={{
                    background: `${color}22`,
                    color,
                    border: `1px solid ${color}55`,
                  }}>
                  {tag}
                </span>
              )
            })}
            {(lead.tags ?? []).length > 3 && (
              <span className="text-[10px]" style={{ color: '#444' }}>+{(lead.tags ?? []).length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Botão remover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(card.id) }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded flex items-center justify-center"
        style={{ color: '#444' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.1)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#444'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
        title="Remover do pipeline"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function KanbanCardOverlay({ data }: { data: KanbanCardData }) {
  return <KanbanCard data={data} onRemove={() => {}} onSelect={() => {}} isDraggingOverlay />
}
