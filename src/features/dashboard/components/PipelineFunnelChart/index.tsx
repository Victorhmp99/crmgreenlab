import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts'
import type { StageCount } from '@/services/dashboard'

interface PipelineFunnelChartProps {
  data: StageCount[]
  isLoading?: boolean
}

interface TooltipPayload {
  payload: StageCount
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p style={{ color: '#666' }}>{d.stageName}</p>
      <p className="font-semibold mt-0.5" style={{ color: '#e8e8e8' }}>
        {d.count} lead{d.count !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function PipelineFunnelChart({ data, isLoading }: PipelineFunnelChartProps) {
  if (isLoading) {
    return <div className="h-full rounded-xl animate-pulse" style={{ background: '#141414', border: '1px solid #1e1e1e' }} />
  }

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl p-5 h-full" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Pipeline por Etapa</p>
          <p className="text-xs mt-0.5" style={{ color: '#444' }}>{total} leads no funil</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#444' }}>
          Nenhum lead no pipeline ainda
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="stageName"
              tick={{ fontSize: 9, fill: '#444' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string) => v.length > 9 ? v.slice(0, 8) + '…' : v}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#444' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {data.map((entry) => (
                <Cell key={entry.stageId} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legenda compacta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {data.map((entry) => (
          <div key={entry.stageId} className="flex items-center gap-1.5 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: '#666' }}>{entry.stageName}</span>
            <span className="font-medium" style={{ color: '#aaa' }}>({entry.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
