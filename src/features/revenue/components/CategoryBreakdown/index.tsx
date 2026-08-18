import { useCategoryBreakdown } from '../../hooks/useFinancial'
import { formatCurrency } from '@/lib/utils'

interface Props {
  dateFrom?:    string
  dateTo?:      string
  periodLabel?: string
}

export function CategoryBreakdown({ dateFrom, dateTo, periodLabel }: Props) {
  const { data = [], isLoading } = useCategoryBreakdown(dateFrom, dateTo)

  const maxValue = Math.max(1, ...data.map((c) => Math.max(c.revenue, c.expenses)))
  const top = data.slice(0, 8)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Receita e Despesa por Categoria</p>
      <p className="text-xs mt-0.5 mb-4" style={{ color: '#444' }}>
        {periodLabel ?? 'No período selecionado'}
        <span className="ml-2" style={{ color: '#00e676' }}>■</span> <span style={{ color: '#555' }}>receita</span>
        <span className="ml-2" style={{ color: '#ff4444' }}>■</span> <span style={{ color: '#555' }}>despesa</span>
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1a1a' }} />)}
        </div>
      ) : top.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: '#555' }}>Nenhum lançamento com categoria no período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {top.map((c) => (
            <div key={c.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: '#ccc' }}>{c.category}</span>
                <span className="tabular-nums" style={{ color: '#666' }}>
                  {c.revenue > 0 && <span style={{ color: '#00e676' }}>{formatCurrency(c.revenue)}</span>}
                  {c.revenue > 0 && c.expenses > 0 && ' · '}
                  {c.expenses > 0 && <span style={{ color: '#ff4444' }}>{formatCurrency(c.expenses)}</span>}
                </span>
              </div>
              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                {c.revenue > 0 && (
                  <div className="h-full rounded-full" style={{ width: `${(c.revenue / maxValue) * 100}%`, background: '#00e676' }} />
                )}
                {c.expenses > 0 && (
                  <div className="h-full rounded-full" style={{ width: `${(c.expenses / maxValue) * 100}%`, background: '#ff4444' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
