import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'
import type { FinancialSummary } from '@/services/financial'

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface SummaryCardProps {
  label:     string
  value:     string
  icon:      React.ElementType
  iconBg:    string
  iconColor: string
  subLabel?: string
  isLoading: boolean
}

function SummaryCard({ label, value, icon: Icon, iconBg, iconColor, subLabel, isLoading }: SummaryCardProps) {
  return (
    <div className="rounded-xl p-5 flex items-start gap-4"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}>
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-7 w-28 rounded-lg animate-pulse" style={{ background: '#1e1e1e' }} />
          <div className="h-4 w-20 rounded animate-pulse" style={{ background: '#1e1e1e' }} />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: '#555' }}>{label}</p>
          {subLabel && <p className="text-xs mt-0.5" style={{ color: '#444' }}>{subLabel}</p>}
        </div>
      )}
    </div>
  )
}

interface FinancialSummaryProps {
  data?:       FinancialSummary
  isLoading:   boolean
  periodLabel: string
}

export function FinancialSummaryCards({ data, isLoading, periodLabel }: FinancialSummaryProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard
        label="Receita Total"
        value={data ? formatBRL(data.totalRevenue) : 'R$ —'}
        icon={TrendingUp}
        iconBg="rgba(0,230,118,0.12)"
        iconColor="#00e676"
        subLabel={data
          ? `${formatBRL(data.autoRevenue)} de ${data.autoRevenueCount} leads · ${formatBRL(data.manualRevenue)} manual`
          : periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Despesas Total"
        value={data ? formatBRL(data.totalExpenses) : 'R$ —'}
        icon={TrendingDown}
        iconBg="rgba(255,68,68,0.12)"
        iconColor="#ff4444"
        subLabel={periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Lucro Líquido"
        value={data ? formatBRL(data.netProfit) : 'R$ —'}
        icon={DollarSign}
        iconBg={data && data.netProfit >= 0 ? 'rgba(64,160,255,0.12)' : 'rgba(251,191,36,0.12)'}
        iconColor={data && data.netProfit >= 0 ? '#40a0ff' : '#fbbf24'}
        subLabel={periodLabel}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Margem de Lucro"
        value={data ? `${data.profitMargin}%` : '—%'}
        icon={Percent}
        iconBg={data && data.profitMargin >= 30 ? 'rgba(167,139,250,0.12)' : 'rgba(150,150,150,0.1)'}
        iconColor={data && data.profitMargin >= 30 ? '#a78bfa' : '#666'}
        isLoading={isLoading}
      />
    </div>
  )
}
