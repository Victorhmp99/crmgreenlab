import { formatDistanceToNow } from '@/lib/dateUtils'
import { ActivityTypeIcon, ACTIVITY_CONFIG } from '../ActivityTypeIcon'
import { cn } from '@/lib/utils'
import type { ActivityWithContext } from '@/services/activities'

interface ActivityItemProps {
  activity:    ActivityWithContext
  showLead?:  boolean   // exibe o nome do lead (usado na página global)
  isLast?:    boolean   // omite a linha vertical no último item da timeline
}

export function ActivityItem({ activity, showLead = false, isLast = false }: ActivityItemProps) {
  const cfg      = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.note
  const isSystem = activity.type === 'stage_change' || activity.type === 'import'

  return (
    <div className="flex gap-3 group">
      {/* Ícone + linha vertical */}
      <div className="flex flex-col items-center">
        <ActivityTypeIcon type={activity.type} size="sm" />
        {!isLast && <div className="w-px flex-1 bg-slate-100 mt-2 min-h-4" />}
      </div>

      {/* Conteúdo */}
      <div className={cn('flex-1 min-w-0 pb-4', isLast && 'pb-0')}>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-xs font-semibold', cfg.text)}>
              {cfg.label}
            </span>
            {showLead && (
              <>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs font-medium text-slate-700">{activity.lead_name}</span>
              </>
            )}
            {activity.user_email && (
              <>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-400">
                  {activity.user_email.split('@')[0]}
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
            {formatDistanceToNow(activity.created_at)}
          </span>
        </div>

        {activity.description && (
          <p className={cn(
            'text-sm mt-0.5 leading-relaxed',
            isSystem ? 'text-slate-400 italic' : 'text-slate-600',
          )}>
            {activity.description}
          </p>
        )}

        {/* Próximo follow-up */}
        {(activity.metadata as Record<string, string>)?.followup_at && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
            📅 Follow-up: {new Date((activity.metadata as Record<string, string>).followup_at).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  )
}
