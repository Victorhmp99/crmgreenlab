import { formatCurrency } from '@/lib/utils'

interface ProgressBarProps {
  label:   string
  actual:  number
  target:  number
  percent: number
  color?:  string   // CSS color value
  unit?:   string
  /** Mostra realizado e alvo em reais (barra de faturamento). */
  moeda?:  boolean
}

export function ProgressBar({ label, actual, target, percent, color = '#00e676', unit, moeda }: ProgressBarProps) {
  const isComplete = percent >= 100
  const mostrar = (n: number) => moeda ? formatCurrency(n) : `${n}${unit ? ` ${unit}` : ''}`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium" style={{ color: '#aaa' }}>{label}</span>
        <span className="font-semibold tabular-nums"
          style={{ color: isComplete ? '#00e676' : '#e8e8e8' }}>
          {mostrar(actual)}{' '}
          <span className="font-normal" style={{ color: '#555' }}>/ {mostrar(target)}</span>
        </span>
      </div>

      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percent, 100)}%`, background: isComplete ? '#00e676' : color }}
        />
      </div>

      <p className="text-[10px] text-right"
        style={{ color: isComplete ? '#00e676' : '#444' }}>
        {isComplete ? '✓ Meta atingida!' : `${percent}% concluído`}
      </p>
    </div>
  )
}
