import { Trash2, Pencil } from 'lucide-react'
import { ProgressBar } from '../ProgressBar'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
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

  if (goal.period === 'monthly') {
    return start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
  if (goal.period === 'quarterly') {
    return `${start.toLocaleDateString('pt-BR', { month: 'short' })} – ${end.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
  }
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
  const { isManager } = usePermissions()
  const active        = isActive(goal)
  const { progress }  = goal
  const displayName   = goal.userFullName ?? goal.userEmail ?? '—'
  const hasAnyTarget  = !!(goal.leads_target || goal.calls_target || goal.deals_target)

  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm p-5 flex flex-col gap-4',
      active ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-slate-400">{PERIOD_LABELS[goal.period]}</span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-500">{periodLabel(goal)}</span>
              {active && (
                <span className="text-[10px] font-semibold text-green-600 bg-green-50 rounded-full px-1.5 py-0.5">
                  ativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progresso geral + ações */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end">
            <span className={cn(
              'text-2xl font-bold tabular-nums',
              progress.overallPercent >= 100 ? 'text-green-600' : 'text-slate-800',
            )}>
              {progress.overallPercent}%
            </span>
            <span className="text-[10px] text-slate-400">geral</span>
          </div>

          {isManager && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => onEdit(goal)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Editar meta"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(goal)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <div className="flex flex-col gap-3 pt-1 border-t border-slate-50">
          {goal.leads_target && (
            <ProgressBar
              label="Leads captados"
              actual={progress.leadsActual}
              target={goal.leads_target}
              percent={progress.leadsPercent}
              color="bg-blue-500"
            />
          )}
          {goal.calls_target && (
            <ProgressBar
              label="Disparos realizados"
              actual={progress.callsActual}
              target={goal.calls_target}
              percent={progress.callsPercent}
              color="bg-amber-500"
            />
          )}
          {goal.deals_target && (
            <ProgressBar
              label="Fechamentos"
              actual={progress.dealsActual}
              target={goal.deals_target}
              percent={progress.dealsPercent}
              color="bg-emerald-500"
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">Nenhuma métrica definida</p>
      )}
    </div>
  )
}
