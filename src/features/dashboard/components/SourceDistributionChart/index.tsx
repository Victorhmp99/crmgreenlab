import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { SourceCount } from '@/services/dashboard'
import type { LeadSource } from '@/types'

interface SourceDistributionChartProps {
  data: SourceCount[]
  isLoading?: boolean
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual:    'Manual',
  import:    'Importado',
  meta_ads:  'Meta Ads',
  google:    'Google',
  referral:  'Indicação',
  other:     'Outro',
}

// Paleta consistente por origem
const SOURCE_COLORS: Record<LeadSource, string> = {
  meta_ads:  '#1877f2',
  google:    '#ea4335',
  referral:  '#10b981',
  manual:    '#6366f1',
  import:    '#f59e0b',
  other:     '#94a3b8',
}

interface TooltipPayload {
  payload: SourceCount & { pct: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">{SOURCE_LABELS[d.source] ?? d.source}</p>
      <p className="text-white font-semibold mt-0.5">{d.count} leads ({d.pct}%)</p>
    </div>
  )
}

export function SourceDistributionChart({ data, isLoading }: SourceDistributionChartProps) {
  if (isLoading) {
    return <div className="h-full rounded-xl bg-slate-100 animate-pulse" />
  }

  const total = data.reduce((s, d) => s + d.count, 0)
  const chartData = data.map((d) => ({
    ...d,
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700">Leads por Origem</p>
        <p className="text-xs text-slate-400 mt-0.5">{total} leads no total</p>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-slate-400">
          Nenhum lead cadastrado ainda
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="shrink-0">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={54}
                  dataKey="count"
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.source}
                      fill={SOURCE_COLORS[entry.source] ?? '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda */}
          <div className="flex flex-col gap-2 flex-1">
            {chartData.map((entry) => (
              <div key={entry.source} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: SOURCE_COLORS[entry.source] ?? '#94a3b8' }}
                  />
                  <span className="text-xs text-slate-600 truncate">
                    {SOURCE_LABELS[entry.source] ?? entry.source}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">
                    {entry.count}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">
                    {entry.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
