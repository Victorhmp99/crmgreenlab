import { formatDistanceToNow } from '@/lib/dateUtils'
import { ActivityTypeIcon, ACTIVITY_CONFIG } from '../ActivityTypeIcon'
import type { ActivityWithContext } from '@/services/activities'

interface ActivityItemProps {
  activity:   ActivityWithContext
  showLead?:  boolean
  isLast?:    boolean
}

export function ActivityItem({ activity, showLead = false, isLast = false }: ActivityItemProps) {
  const cfg      = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.note
  const isSystem = activity.type === 'stage_change' || activity.type === 'import'

  return (
    <div className="flex gap-3">
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
          <span className="text-[11px] whitespace-nowrap shrink-0" style={{ color: '#444' }}>
            {formatDistanceToNow(activity.created_at)}
          </span>
        </div>

        {activity.description && (
          <p className="text-sm mt-0.5 leading-relaxed"
            style={{ color: isSystem ? '#555' : '#888', fontStyle: isSystem ? 'italic' : undefined }}>
            {activity.description}
          </p>
        )}

        {/* Próximo follow-up */}
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
