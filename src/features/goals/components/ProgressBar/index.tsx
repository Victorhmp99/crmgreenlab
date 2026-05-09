import { cn } from '@/lib/utils'

interface ProgressBarProps {
  label:   string
  actual:  number
  target:  number
  percent: number
  color?:  string   // classe bg-* Tailwind
  unit?:   string
}

export function ProgressBar({ label, actual, target, percent, color = 'bg-blue-500', unit }: ProgressBarProps) {
  const isComplete = percent >= 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={cn('font-semibold tabular-nums', isComplete ? 'text-green-600' : 'text-slate-700')}>
          {actual}{unit ? ` ${unit}` : ''}{' '}
          <span className="font-normal text-slate-400">/ {target}{unit ? ` ${unit}` : ''}</span>
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', isComplete ? 'bg-green-500' : color)}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className={cn('text-[10px] text-right', isComplete ? 'text-green-600 font-medium' : 'text-slate-400')}>
        {isComplete ? '✓ Meta atingida!' : `${percent}% concluído`}
      </p>
    </div>
  )
}
