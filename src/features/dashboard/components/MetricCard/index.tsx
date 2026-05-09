import { type ElementType } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label:       string
  value:       number | string
  icon:        ElementType
  color:       string        // classe bg-* do ícone
  current?:    number        // valor atual para calcular delta
  previous?:   number        // valor do período anterior
  deltaLabel?: string        // ex: "vs ontem", "vs mês anterior"
  isLoading?:  boolean
}

function calcDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function MetricCard({
  label, value, icon: Icon, color,
  current, previous, deltaLabel = 'vs período anterior',
  isLoading,
}: MetricCardProps) {
  const showDelta = current !== undefined && previous !== undefined
  const delta     = showDelta ? calcDelta(current!, previous!) : 0
  const isUp      = delta > 0
  const isFlat    = delta === 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', color)}>
          <Icon size={20} className="text-white" />
        </div>

        {showDelta && !isLoading && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
            isFlat
              ? 'bg-slate-100 text-slate-500'
              : isUp
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-500',
          )}>
            {isFlat
              ? <Minus size={11} />
              : isUp
              ? <TrendingUp size={11} />
              : <TrendingDown size={11} />
            }
            {Math.abs(delta)}%
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-20 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-3.5 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
          <p className="text-sm font-medium text-slate-500 mt-0.5">{label}</p>
          {showDelta && (
            <p className="text-xs text-slate-400 mt-1">{deltaLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}
