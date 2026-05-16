import { Trash2, CheckSquare, Square } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/dateUtils'
import { ActivityTypeIcon, ACTIVITY_CONFIG } from '../ActivityTypeIcon'
import { useActivityMutations } from '../../hooks/useActivityMutations'
import type { ActivityWithContext } from '@/services/activities'

interface ActivityItemProps {
  activity:   ActivityWithContext
  showLead?:  boolean
  isLast?:    boolean
  /** Modo seleção em massa */
  selectionMode?: boolean
  selected?:      boolean
  onToggleSelect?: (id: string) => void
}

export function ActivityItem({
  activity, showLead = false, isLast = false,
  selectionMode = false, selected = false, onToggleSelect,
}: ActivityItemProps) {
  const cfg      = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.note
  const isSystem = activity.type === 'stage_change' || activity.type === 'import'

  const { remove } = useActivityMutations()

  function handleDelete() {
    if (!confirm(`Excluir este disparo de "${cfg.label}"? Esta ação não pode ser desfeita.`)) return
    remove.mutate({ id: activity.id, leadId: activity.lead_id })
  }

  function handleRowClick() {
    if (selectionMode) onToggleSelect?.(activity.id)
  }

  return (
    <div
      className={`flex gap-3 group rounded-lg ${selectionMode ? 'cursor-pointer p-1.5 -m-1.5' : ''}`}
      style={selected ? { background: 'rgba(0,230,118,0.06)' } : undefined}
      onClick={handleRowClick}>
      {/* Checkbox em modo seleção */}
      {selectionMode && (
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect?.(activity.id) }}
          className="h-5 w-5 rounded shrink-0 mt-1 flex items-center justify-center transition-colors"
          style={{ color: selected ? '#00e676' : '#555' }}>
          {selected ? <CheckSquare size={15} /> : <Square size={15} />}
        </button>
      )}

      {/* Ícone + linha vertical */}
      <div className="flex flex-col items-center">
        <ActivityTypeIcon type={activity.type} size="sm" />
        {!isLast && <div className="w-px flex-1 mt-2 min-h-4" style={{ background: '#1e1e1e' }} />}
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: cfg.text }}>
              {cfg.label}
            </span>
            {showLead && (
              <>
                <span className="text-xs" style={{ color: '#333' }}>·</span>
                <span className="text-xs font-medium" style={{ color: '#aaa' }}>{activity.lead_name}</span>
              </>
            )}
            {activity.user_email && (
              <>
                <span className="text-xs" style={{ color: '#333' }}>·</span>
                <span className="text-xs" style={{ color: '#555' }}>
                  {activity.user_email.split('@')[0]}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] whitespace-nowrap" style={{ color: '#444' }}>
              {formatDistanceToNow(activity.created_at)}
            </span>
            {!selectionMode && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete() }} disabled={remove.isPending} title="Excluir disparo"
                className="h-7 inline-flex items-center gap-1 px-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                style={{ color: '#ff4444', background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.25)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,68,68,0.12)' }}>
                <Trash2 size={12} />
                Excluir
              </button>
            )}
          </div>
        </div>

        {activity.description && (
          <p className="text-sm mt-0.5 leading-relaxed"
            style={{ color: isSystem ? '#555' : '#888', fontStyle: isSystem ? 'italic' : undefined }}>
            {activity.description}
          </p>
        )}

        {(activity.metadata as Record<string, string>)?.followup_at && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
            📅 Follow-up: {new Date((activity.metadata as Record<string, string>).followup_at).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  )
}
