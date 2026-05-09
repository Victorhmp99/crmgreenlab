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

interface TooltipPayload { value: number }

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p style={{ color: '#666' }}>{label ? formatDay(label) : ''}</p>
      <p className="font-semibold mt-0.5" style={{ color: '#00e676' }}>
        {payload[0].value} lead{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function LeadsEvolutionChart({ data, isLoading }: LeadsEvolutionChartProps) {
  if (isLoading) {
    return <div className="h-48 rounded-xl animate-pulse" style={{ background: '#141414', border: '1px solid #1e1e1e' }} />
  }

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Evolução de Leads</p>
          <p className="text-xs mt-0.5" style={{ color: '#444' }}>Últimos 30 dias</p>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--tenant-primary)' }}>{total}</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00e676" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: '#444' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#444' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a2a2a' }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#00e676"
            strokeWidth={2}
            fill="url(#leadGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#00e676', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
