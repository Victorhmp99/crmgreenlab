import { useCategoryBreakdown } from '../../hooks/useFinancial'
import { formatCurrency } from '@/lib/utils'

interface Props {
  dateFrom?:    string
  dateTo?:      string
  periodLabel?: string
}

/**
 * Despesas por categoria.
 *
 * Só despesa de propósito: a receita por categoria agora vem das VENDAS
 * (contratos + avulsos, em "Categorias que mais vendem"), que é onde ela de
 * fato acontece. Mostrar receita aqui também duplicava o mesmo número em
 * dois cards — e pior, com base diferente, já que contrato fechado não gera
 * lançamento financeiro.
 */
export function CategoryBreakdown({ dateFrom, dateTo, periodLabel }: Props) {
  const { data = [], isLoading } = useCategoryBreakdown(dateFrom, dateTo)

  const despesas = data
    .filter((c) => c.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses)
    .slice(0, 8)

  const maxValue = Math.max(1, ...despesas.map((c) => c.expenses))
  const total    = despesas.reduce((s, c) => s + c.expenses, 0)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Despesas por categoria</p>
      <p className="text-xs mt-0.5 mb-4" style={{ color: '#444' }}>
        {total > 0
          ? `${formatCurrency(total)}${periodLabel ? ` em ${periodLabel}` : ' no período'}`
          : (periodLabel ?? 'No período selecionado')}
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1a1a' }} />)}
        </div>
      ) : despesas.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: '#555' }}>Nenhuma despesa no período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {despesas.map((c) => (
            <div key={c.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: '#ccc' }}>{c.category}</span>
                <span className="tabular-nums" style={{ color: '#ff4444' }}>{formatCurrency(c.expenses)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(c.expenses / maxValue) * 100}%`, background: '#ff4444' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
