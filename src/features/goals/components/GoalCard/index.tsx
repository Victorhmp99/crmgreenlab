import { Trash2, Pencil } from 'lucide-react'
import { ProgressBar } from '../ProgressBar'
import { usePermissions } from '@/hooks/usePermissions'
import type { GoalWithProgress } from '@/services/goals'
import type { GoalPeriod } from '@/types'

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily:     'Diária',
  weekly:    'Semanal',
  monthly:   'Mensal',
  quarterly: 'Trimestral',
}

function periodLabel(goal: GoalWithProgress): string {
  const start = new Date(goal.start_date + 'T12:00:00')
  const end   = new Date(goal.end_date   + 'T12:00:00')
  if (goal.period === 'monthly')
    return start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  if (goal.period === 'quarterly')
    return `${start.toLocaleDateString('pt-BR', { month: 'short' })} – ${end.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

function isActive(goal: GoalWithProgress): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return goal.start_date <= today && goal.end_date >= today
}

interface GoalCardProps {
  goal:     GoalWithProgress
  onEdit:   (goal: GoalWithProgress) => void
  onDelete: (goal: GoalWithProgress) => void
}

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { isManager }  = usePermissions()
  const active         = isActive(goal)
  const { progress }   = goal
  const displayName    = goal.userFullName ?? goal.userEmail ?? '—'
  const hasAnyTarget   = !!(goal.leads_target || goal.calls_target || goal.deals_target)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        background: '#141414',
        border: `1px solid ${active ? 'rgba(0,230,118,0.25)' : '#1e1e1e'}`,
        boxShadow: active ? '0 0 12px rgba(0,230,118,0.06)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-black font-semibold text-sm shrink-0"
            style={{ background: 'var(--tenant-primary)' }}>
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: '#e8e8e8' }}>{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs" style={{ color: '#555' }}>{PERIOD_LABELS[goal.period]}</span>
              <span className="text-xs" style={{ color: '#2a2a2a' }}>·</span>
              <span className="text-xs" style={{ color: '#666' }}>{periodLabel(goal)}</span>
              {active && (
                <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                  style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676' }}>
                  ativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progresso geral + ações */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold tabular-nums"
              style={{ color: progress.overallPercent >= 100 ? '#00e676' : '#e8e8e8' }}>
              {progress.overallPercent}%
            </span>
            <span className="text-[10px]" style={{ color: '#444' }}>geral</span>
          </div>

          {isManager && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => onEdit(goal)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#00e676'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,230,118,0.08)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#555'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                title="Editar meta"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(goal)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.08)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#555'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                title="Excluir meta"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barras de progresso */}
      {hasAnyTarget ? (
        <div className="flex flex-col gap-3 pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
          {goal.leads_target && (
            <ProgressBar label="Leads captados" actual={progress.leadsActual}
              target={goal.leads_target} percent={progress.leadsPercent} color="#40a0ff" />
          )}
          {goal.calls_target && (
            <ProgressBar label="Disparos realizados" actual={progress.callsActual}
              target={goal.calls_target} percent={progress.callsPercent} color="#fbbf24" />
          )}
          {goal.deals_target && (
            <ProgressBar label="Fechamentos" actual={progress.dealsActual}
              target={goal.deals_target} percent={progress.dealsPercent} color="#00e676" />
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-2" style={{ color: '#444' }}>Nenhuma métrica definida</p>
      )}
    </div>
  )
}
