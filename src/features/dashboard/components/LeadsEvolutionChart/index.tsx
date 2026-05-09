import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { DayCount } from '@/services/dashboard'

interface LeadsEvolutionChartProps {
  data: DayCount[]
  isLoading?: boolean
}

function formatDay(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Só mostra label a cada 5 dias para não poluir o eixo X
function tickFormatter(value: string, index: number): string {
  return index % 5 === 0 ? formatDay(value) : ''
}

interface TooltipPayload {
  value: number
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{label ? formatDay(label) : ''}</p>
      <p className="text-white font-semibold mt-0.5">
        {payload[0].value} lead{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function LeadsEvolutionChart({ data, isLoading }: LeadsEvolutionChartProps) {
  if (isLoading) {
    return <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
  }

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Evolução de Leads</p>
          <p className="text-xs text-slate-400 mt-0.5">Últimos 30 dias</p>
        </div>
        <span className="text-2xl font-bold text-slate-900 tabular-nums">{total}</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0' }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#leadGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
