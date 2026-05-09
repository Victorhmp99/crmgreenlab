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
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{d.stageName}</p>
      <p className="text-white font-semibold mt-0.5">
        {d.count} lead{d.count !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export function PipelineFunnelChart({ data, isLoading }: PipelineFunnelChartProps) {
  if (isLoading) {
    return <div className="h-full rounded-xl bg-slate-100 animate-pulse" />
  }

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Pipeline por Etapa</p>
          <p className="text-xs text-slate-400 mt-0.5">{total} leads no funil</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-slate-400">
          Nenhum lead no pipeline ainda
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="stageName"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              // Trunca nomes longos
              tickFormatter={(v: string) => v.length > 9 ? v.slice(0, 8) + '…' : v}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
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
          <div key={entry.stageId} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.stageName}</span>
            <span className="font-medium text-slate-700">({entry.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
