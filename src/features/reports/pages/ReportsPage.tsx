import { useState } from 'react'
import { Users, Kanban, Megaphone, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import {
  useSellerPerformance,
  useFunnelBreakdown,
  useCampaignPerformance,
  useSourceBreakdown,
} from '../hooks/useReports'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'

// ── Cores por posição ─────────────────────────────────────────────────────────
const SOURCE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#94a3b8']

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentMonthRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }
}

// ── Componentes internos ──────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-blue-600" />
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { from, to } = currentMonthRange()
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo,   setDateTo]   = useState(to)

  const { data: sellers    = [], isLoading: sellersLoading }   = useSellerPerformance(dateFrom, dateTo)
  const { data: funnel     = [], isLoading: funnelLoading }    = useFunnelBreakdown()
  const { data: campaigns  = [], isLoading: campaignsLoading } = useCampaignPerformance()
  const { data: sources    = [], isLoading: sourcesLoading }   = useSourceBreakdown()

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Relatórios</h2>
          <p className="text-sm text-slate-500 mt-0.5">Performance por vendedor e canal</p>
        </div>

        {/* Filtro de período (afeta a seção de vendedores) */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">De</label>
            <Input type="date" value={dateFrom} className="w-32"
              onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Até</label>
            <Input type="date" value={dateTo} className="w-32"
              onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Performance por vendedor */}
      <Card>
        <SectionTitle icon={Users} title="Performance por Vendedor" />
        {sellersLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : sellers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum dado para este período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left font-medium text-slate-500 text-xs">Vendedor</th>
                  <th className="pb-2 text-right font-medium text-slate-500 text-xs">Leads</th>
                  <th className="pb-2 text-right font-medium text-slate-500 text-xs">Disparos</th>
                  <th className="pb-2 text-right font-medium text-slate-500 text-xs">Fechamentos</th>
                  <th className="pb-2 text-right font-medium text-slate-500 text-xs">Conv. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sellers.map((s, i) => (
                  <tr key={s.userId} className="hover:bg-slate-50/50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5">#{i + 1}</span>
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {(s.fullName ?? s.email)[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-700 truncate max-w-[160px]">
                          {s.fullName ?? s.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-800 tabular-nums">{s.leads}</td>
                    <td className="py-3 text-right text-slate-600 tabular-nums">{s.activities}</td>
                    <td className="py-3 text-right text-emerald-600 font-semibold tabular-nums">{s.conversions}</td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.convRate >= 20 ? 'bg-green-100 text-green-700'
                        : s.convRate >= 10 ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.convRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Funil + Campanhas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil por etapa */}
        <Card>
          <SectionTitle icon={Kanban} title="Distribuição do Funil" />
          {funnelLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : funnel.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Pipeline vazio</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={funnel} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="stageName" tick={{ fontSize: 9, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 7) + '…' : v} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} leads`, '']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff' }} />
                  <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={36}>
                    {funnel.map((entry) => (
                      <Cell key={entry.stageId} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                {funnel.map((s) => (
                  <span key={s.stageId} className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.stageName} ({s.count}) · {s.pct}%
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Campanhas */}
        <Card>
          <SectionTitle icon={Megaphone} title="Performance por Campanha" />
          {campaignsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma campanha registrada</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {campaigns.slice(0, 10).map((c, i) => (
                <div key={c.campaign} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{c.campaign}</p>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 mt-1">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.max((c.leads / (campaigns[0]?.leads || 1)) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-slate-800 tabular-nums">{c.leads}</p>
                    <p className="text-[10px] text-emerald-600">{c.convRate}% conv</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Breakdown por origem */}
      <Card>
        <SectionTitle icon={ArrowUpRight} title="Leads por Origem" />
        {sourcesLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {sources.map((s, i) => (
              <div key={s.source}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex flex-col gap-1 text-center">
                <div className="h-2 w-2 rounded-full mx-auto" style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                <p className="text-xs font-medium text-slate-600 capitalize">{s.source.replace('_', ' ')}</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{s.leads}</p>
                <p className="text-[10px] text-emerald-600 font-medium">{s.convRate}% conv</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
