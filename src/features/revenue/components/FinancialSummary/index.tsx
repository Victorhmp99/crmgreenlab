import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FinancialSummary } from '@/services/financial'

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface SummaryCardProps {
  label:     string
  value:     string
  icon:      React.ElementType
  color:     string
  subLabel?: string
  isLoading: boolean
}

function SummaryCard({ label, value, icon: Icon, color, subLabel, isLoading }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-4">
      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon size={20} className="text-white" />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-7 w-28 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          <p className="text-sm font-medium text-slate-500 mt-0.5">{label}</p>
          {subLabel && <p className="text-xs text-slate-400 mt-0.5">{subLabel}</p>}
        </div>
      )}
    </div>
  )
}

interface FinancialSummaryProps {
  data?:     FinancialSummary
  isLoading: boolean
  periodLabel: string
}

export function FinancialSummaryCards({ data, isLoading, periodLabel }: FinancialSummaryProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard
        label="Receita Total"
        value={data ? formatBRL(data.totalRevenue) : 'R$ —'}
        icon={TrendingUp}
        color="bg-emerald-600"
        subLabel={periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Despesas Total"
        value={data ? formatBRL(data.totalExpenses) : 'R$ —'}
        icon={TrendingDown}
        color="bg-red-500"
        subLabel={periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Lucro Líquido"
        value={data ? formatBRL(data.netProfit) : 'R$ —'}
        icon={DollarSign}
        color={data && data.netProfit >= 0 ? 'bg-blue-600' : 'bg-amber-500'}
        subLabel={periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Margem de Lucro"
        value={data ? `${data.profitMargin}%` : '—%'}
        icon={Percent}
        color={data && data.profitMargin >= 30 ? 'bg-violet-600' : 'bg-slate-500'}
        isLoading={isLoading}
      />
    </div>
  )
}
