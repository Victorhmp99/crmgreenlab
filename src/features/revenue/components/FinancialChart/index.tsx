import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { MonthlyPoint } from '@/services/financial'

interface FinancialChartProps {
  data:      MonthlyPoint[]
  isLoading: boolean
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(0)}k`
  return `R$${value.toFixed(0)}`
}

interface TooltipPayload {
  name:  string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  return (
    <div className="rounded-xl px-4 py-3 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="font-medium mb-2" style={{ color: '#666' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span style={{ color: '#aaa' }}>{p.name}</span>
          </div>
          <span className="font-semibold" style={{ color: '#e8e8e8' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function FinancialChart({ data, isLoading }: FinancialChartProps) {
  if (isLoading) {
    return <div className="h-64 rounded-xl animate-pulse" style={{ background: '#141414', border: '1px solid #1e1e1e' }} />
  }

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="mb-5">
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Evolução Financeira</p>
        <p className="text-xs mt-0.5" style={{ color: '#444' }}>Receitas, despesas e lucro por mês</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#444' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: '#444' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => <span className="text-xs" style={{ color: '#666' }}>{value}</span>} />
          <Bar dataKey="revenue"  name="Receita"  fill="#00e676" radius={[4,4,0,0]} maxBarSize={32} opacity={0.8} />
          <Bar dataKey="expenses" name="Despesas" fill="#ff4444" radius={[4,4,0,0]} maxBarSize={32} opacity={0.8} />
          <Line dataKey="profit" name="Lucro" stroke="#40a0ff" strokeWidth={2.5}
            dot={{ r: 3, fill: '#40a0ff', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
