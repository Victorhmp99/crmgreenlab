import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { SourceCount } from '@/services/dashboard'
import type { LeadSource } from '@/types'

interface SourceDistributionChartProps {
  data: SourceCount[]
  isLoading?: boolean
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  manual:   'Manual',
  import:   'Importado',
  meta_ads: 'Meta Ads',
  google:   'Google',
  referral: 'Indicação',
  other:    'Outro',
}

const SOURCE_COLORS: Record<LeadSource, string> = {
  meta_ads: '#1877f2',
  google:   '#ea4335',
  referral: '#00e676',
  manual:   '#a78bfa',
  import:   '#fbbf24',
  other:    '#555',
}

interface TooltipPayload {
  payload: SourceCount & { pct: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p style={{ color: '#666' }}>{SOURCE_LABELS[d.source] ?? d.source}</p>
      <p className="font-semibold mt-0.5" style={{ color: '#e8e8e8' }}>{d.count} leads ({d.pct}%)</p>
    </div>
  )
}

export function SourceDistributionChart({ data, isLoading }: SourceDistributionChartProps) {
  if (isLoading) {
    return <div className="h-full rounded-xl animate-pulse" style={{ background: '#141414', border: '1px solid #1e1e1e' }} />
  }

  const total = data.reduce((s, d) => s + d.count, 0)
  const chartData = data.map((d) => ({
    ...d,
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }))

  return (
    <div className="rounded-xl p-5 h-full" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="mb-4">
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Leads por Origem</p>
        <p className="text-xs mt-0.5" style={{ color: '#444' }}>{total} leads no total</p>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#444' }}>
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
                  stroke="#141414"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.source}
                      fill={SOURCE_COLORS[entry.source] ?? '#555'}
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
                    style={{ backgroundColor: SOURCE_COLORS[entry.source] ?? '#555' }}
                  />
                  <span className="text-xs truncate" style={{ color: '#888' }}>
                    {SOURCE_LABELS[entry.source] ?? entry.source}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: '#e8e8e8' }}>
                    {entry.count}
                  </span>
                  <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: '#444' }}>
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
