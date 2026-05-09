import { type ElementType } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label:          string
  value:          number | string
  icon:           ElementType
  iconColor:      string   // background do ícone (ex: rgba(0,230,118,0.15))
  iconTextColor:  string   // cor do ícone em si
  current?:       number
  previous?:      number
  deltaLabel?:    string
  isLoading?:     boolean
}

function calcDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function MetricCard({
  label, value, icon: Icon, iconColor, iconTextColor,
  current, previous, deltaLabel = 'vs período anterior',
  isLoading,
}: MetricCardProps) {
  const showDelta = current !== undefined && previous !== undefined
  const delta     = showDelta ? calcDelta(current!, previous!) : 0
  const isUp      = delta > 0
  const isFlat    = delta === 0

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}
    >
      <div className="flex items-start justify-between">
        {/* Ícone */}
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconColor }}
        >
          <Icon size={20} style={{ color: iconTextColor }} />
        </div>

        {/* Delta badge */}
        {showDelta && !isLoading && (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
            style={
              isFlat
                ? { background: 'rgba(255,255,255,0.05)', color: '#666' }
                : isUp
                ? { background: 'rgba(0,230,118,0.1)', color: '#00e676' }
                : { background: 'rgba(255,68,68,0.1)', color: '#ff4444' }
            }
          >
            {isFlat ? <Minus size={11} /> : isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-20 rounded-lg animate-pulse" style={{ background: '#1e1e1e' }} />
          <div className="h-3.5 w-32 rounded animate-pulse" style={{ background: '#1e1e1e' }} />
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: '#555' }}>{label}</p>
          {showDelta && (
            <p className="text-xs mt-1" style={{ color: '#444' }}>{deltaLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}
