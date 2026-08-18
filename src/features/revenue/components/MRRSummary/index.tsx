import { Repeat, Users } from 'lucide-react'
import { SummaryCard } from '../FinancialSummary'
import { useActiveMRR } from '../../hooks/useFinancial'
import { formatCurrency } from '@/lib/utils'

export function MRRSummary() {
  const { data, isLoading } = useActiveMRR()

  return (
    <div className="grid grid-cols-2 gap-4">
      <SummaryCard
        label="MRR Ativo"
        value={data ? formatCurrency(data.activeMRR) : 'R$ —'}
        icon={Repeat}
        iconBg="rgba(64,160,255,0.12)"
        iconColor="#40a0ff"
        subLabel="Receita recorrente mensal comprometida"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Contratos Recorrentes"
        value={data ? String(data.activeContracts) : '—'}
        icon={Users}
        iconBg="rgba(167,139,250,0.12)"
        iconColor="#a78bfa"
        subLabel="Ativos no momento"
        isLoading={isLoading}
      />
    </div>
  )
}
