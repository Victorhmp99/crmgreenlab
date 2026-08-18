import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useCategoryBreakdown } from '../../hooks/useFinancial'
import { formatCurrency } from '@/lib/utils'

interface Props {
  dateFrom?: string
  dateTo?:   string
}

const COLORS = ['#00e676', '#40a0ff', '#a78bfa', '#fbbf24', '#ec4899', '#22d3ee', '#f97316', '#84cc16']

interface TooltipPayload { name: string; value: number; payload: { category: string } }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-xl px-4 py-2.5 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="mb-1" style={{ color: '#aaa' }}>{p.payload.category}</p>
      <p className="font-semibold" style={{ color: '#00e676' }}>{formatCurrency(p.value)}</p>
    </div>
  )
}

export function RevenuePieChart({ dateFrom, dateTo }: Props) {
  const { data = [], isLoading } = useCategoryBreakdown(dateFrom, dateTo)

  const revenueData = data
    .filter((c) => c.revenue > 0)
    .map((c) => ({ category: c.category, value: c.revenue }))
    .sort((a, b) => b.value - a.value)

  const total = revenueData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Receita por Categoria</p>
      <p className="text-xs mt-0.5 mb-4" style={{ color: '#444' }}>
        {total > 0 ? `${formatCurrency(total)} no período` : 'Distribuição da receita'}
      </p>

      {isLoading ? (
        <div className="h-56 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />
      ) : revenueData.length === 0 ? (
        <p className="text-xs text-center py-16" style={{ color: '#555' }}>Nenhuma receita com categoria no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={revenueData}
              dataKey="value"
              nameKey="category"
              cx="50%" cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
            >
              {revenueData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#141414" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical" verticalAlign="middle" align="right"
              formatter={(value) => <span className="text-xs" style={{ color: '#888' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
