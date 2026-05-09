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
  active?: boolean
  payload?: TooltipPayload[]
  label?:  string
}) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="rounded-xl bg-slate-900 px-4 py-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-300">{p.name}</span>
          </div>
          <span className="text-white font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function FinancialChart({ data, isLoading }: FinancialChartProps) {
  if (isLoading) {
    return <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-semibold text-slate-700">Evolução Financeira</p>
        <p className="text-xs text-slate-400 mt-0.5">Receitas, despesas e lucro por mês</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-slate-500">{value}</span>
            )}
          />
          <Bar dataKey="revenue"  name="Receita"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={32} opacity={0.85} />
          <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={32} opacity={0.85} />
          <Line
            dataKey="profit"
            name="Lucro"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
