import { TrendingUp, TrendingDown, DollarSign, Percent, Wallet } from 'lucide-react'
import type { FinancialSummary } from '@/services/financial'

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

interface SummaryCardProps {
  label:        string
  value:        string
  icon:         React.ElementType
  iconBg:       string
  iconColor:    string
  subLabel?:    string
  isLoading:    boolean
  delta?:       number | null
  deltaGoodDirection?: 'up' | 'down'
}

export function SummaryCard({
  label, value, icon: Icon, iconBg, iconColor, subLabel, isLoading, delta, deltaGoodDirection = 'up',
}: SummaryCardProps) {
  const deltaIsGood = delta == null ? null : deltaGoodDirection === 'up' ? delta >= 0 : delta <= 0

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
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{value}</p>
            {delta != null && (
              <span className="text-xs font-semibold tabular-nums"
                style={{ color: deltaIsGood ? '#00e676' : '#ff4444' }}
                title="Comparado ao mês anterior">
                {delta > 0 ? '+' : ''}{delta}%
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-0.5" style={{ color: '#555' }}>{label}</p>
          {subLabel && <p className="text-xs mt-0.5" style={{ color: '#444' }}>{subLabel}</p>}
        </div>
      )}
    </div>
  )
}

interface FinancialSummaryProps {
  data?:              FinancialSummary
  previousData?:      FinancialSummary
  faturamento?:       number
  wonCount?:          number
  isLoading:          boolean
  periodLabel:        string
}

export function FinancialSummaryCards({
  data, previousData, faturamento, wonCount, isLoading, periodLabel,
}: FinancialSummaryProps) {
  const revenueDelta  = data && previousData ? deltaPercent(data.totalRevenue, previousData.totalRevenue) : null
  const expensesDelta = data && previousData ? deltaPercent(data.totalExpenses, previousData.totalExpenses) : null
  const profitDelta   = data && previousData ? deltaPercent(data.netProfit, previousData.netProfit) : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <SummaryCard
        label="Faturamento"
        value={faturamento != null ? formatBRL(faturamento) : 'R$ —'}
        icon={DollarSign}
        iconBg="rgba(167,139,250,0.12)"
        iconColor="#a78bfa"
        subLabel={`Vendido — ${wonCount ?? 0} fechamento${wonCount === 1 ? '' : 's'}`}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Receita"
        value={data ? formatBRL(data.totalRevenue) : 'R$ —'}
        icon={Wallet}
        iconBg="rgba(0,230,118,0.12)"
        iconColor="#00e676"
        subLabel="Dinheiro que já entrou"
        isLoading={isLoading}
        delta={revenueDelta}
        deltaGoodDirection="up"
      />
      <SummaryCard
        label="Despesas"
        value={data ? formatBRL(data.totalExpenses) : 'R$ —'}
        icon={TrendingDown}
        iconBg="rgba(255,68,68,0.12)"
        iconColor="#ff4444"
        subLabel={periodLabel}
        isLoading={isLoading}
        delta={expensesDelta}
        deltaGoodDirection="down"
      />
      <SummaryCard
        label="Lucro Líquido"
        value={data ? formatBRL(data.netProfit) : 'R$ —'}
        icon={TrendingUp}
        iconBg={data && data.netProfit >= 0 ? 'rgba(64,160,255,0.12)' : 'rgba(251,191,36,0.12)'}
        iconColor={data && data.netProfit >= 0 ? '#40a0ff' : '#fbbf24'}
        subLabel="Receita − despesas"
        isLoading={isLoading}
        delta={profitDelta}
        deltaGoodDirection="up"
      />
      <SummaryCard
        label="Margem de Lucro"
        value={data ? `${data.profitMargin}%` : '—%'}
        icon={Percent}
        iconBg={data && data.profitMargin >= 30 ? 'rgba(167,139,250,0.12)' : 'rgba(150,150,150,0.1)'}
        iconColor={data && data.profitMargin >= 30 ? '#a78bfa' : '#666'}
        subLabel="Do que entrou, quanto sobra"
        isLoading={isLoading}
      />
    </div>
  )
}
