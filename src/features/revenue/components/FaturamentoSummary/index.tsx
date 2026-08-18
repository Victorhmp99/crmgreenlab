import { DollarSign, Wallet } from 'lucide-react'
import { SummaryCard } from '../FinancialSummary'
import { useFaturamentoReceita } from '../../hooks/useFinancial'
import { formatCurrency } from '@/lib/utils'

interface Props {
  dateFrom?: string
  dateTo?:   string
  periodLabel: string
}

export function FaturamentoSummary({ dateFrom, dateTo, periodLabel }: Props) {
  const { data, isLoading } = useFaturamentoReceita(dateFrom, dateTo)

  return (
    <div className="grid grid-cols-2 gap-4">
      <SummaryCard
        label="Faturamento"
        value={data ? formatCurrency(data.faturamento) : 'R$ —'}
        icon={DollarSign}
        iconBg="rgba(0,230,118,0.12)"
        iconColor="#00e676"
        subLabel={`Valor total vendido — ${data?.wonCount ?? 0} fechamento${data?.wonCount === 1 ? '' : 's'}`}
        isLoading={isLoading}
      />
      <SummaryCard
        label="Receita"
        value={data ? formatCurrency(data.receita) : 'R$ —'}
        icon={Wallet}
        iconBg="rgba(64,160,255,0.12)"
        iconColor="#40a0ff"
        subLabel={`Dinheiro de fato recebido — ${periodLabel}`}
        isLoading={isLoading}
      />
    </div>
  )
}
