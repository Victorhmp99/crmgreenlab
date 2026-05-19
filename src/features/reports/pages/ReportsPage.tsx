import { useState } from 'react'
import { Users, Kanban, Megaphone, ArrowUpRight, Tag, Filter, BarChart3, Settings as SettingsIcon } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils'
import { HorizontalFunnel } from '@/features/funnel/components/HorizontalFunnel'
import { FunnelStepsManager } from '@/features/funnel/components/FunnelStepsManager'
import { PipelineMapping } from '@/features/funnel/components/PipelineMapping'
import {
  useSellerPerformance,
  useFunnelBreakdown,
  useCampaignPerformance,
  useSourceBreakdown,
  usePipelineBreakdown,
} from '../hooks/useReports'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'

// Cores por posição para origens
const SOURCE_COLORS = ['#00e676', '#a78bfa', '#fbbf24', '#ec4899', '#40a0ff', '#555']

function currentMonthRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} style={{ color: 'var(--tenant-primary)' }} />
      <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>{title}</h3>
    </div>
  )
}

function DarkCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`}
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      {children}
    </div>
  )
}

type ReportsTab = 'overview' | 'funnel-config'

// ── Page ─────────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { from, to } = currentMonthRange()
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo,   setDateTo]   = useState(to)
  const [tab, setTab] = useState<ReportsTab>('overview')

  const { data: sellers   = [], isLoading: sellersLoading }   = useSellerPerformance(dateFrom, dateTo)
  const { data: funnel    = [], isLoading: funnelLoading }    = useFunnelBreakdown()
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaignPerformance()
  const { data: sources   = [], isLoading: sourcesLoading }   = useSourceBreakdown()
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelineBreakdown()

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Relatórios</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Performance por vendedor e canal</p>
        </div>

        {/* Filtro de período (só na aba Visão Geral) */}
        {tab === 'overview' && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: '#666' }}>De</label>
              <Input type="date" value={dateFrom} className="w-32"
                onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: '#666' }}>Até</label>
              <Input type="date" value={dateTo} className="w-32"
                onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl p-1 self-start"
        style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border-dim)' }}>
        {([
          { id: 'overview',     label: 'Visão Geral',          icon: BarChart3 },
          { id: 'funnel-config',label: 'Configuração do Funil',icon: SettingsIcon },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={
              tab === id
                ? { background: 'var(--bg-surface)', color: 'var(--text)', border: '1px solid var(--border)' }
                : { color: 'var(--text-dim)' }
            }>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'funnel-config' && (
        <>
          <FunnelStepsManager />
          <PipelineMapping />
        </>
      )}

      {tab === 'overview' && (<>

      {/* Performance por vendedor */}
      <DarkCard>
        <SectionTitle icon={Users} title="Performance por Vendedor" />
        {sellersLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : sellers.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#444' }}>Nenhum dado para este período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['Vendedor', 'Leads', 'Fechados', 'Receita', 'Previsão', 'Perdas', 'Ticket Médio', 'Conv. %'].map((h, i) => (
                    <th key={h} className={`pb-2 text-xs font-medium uppercase tracking-wide ${i > 0 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#444' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellers.map((s, i) => (
                  <tr key={s.userId} style={{ borderBottom: '1px solid #191919' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-5 tabular-nums" style={{ color: '#444' }}>#{i + 1}</span>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-black text-[10px] font-bold shrink-0"
                          style={{ background: 'var(--tenant-primary)' }}>
                          {(s.fullName ?? s.email)[0].toUpperCase()}
                        </div>
                        <span className="font-medium truncate max-w-[160px]" style={{ color: '#e8e8e8' }}>
                          {s.fullName ?? s.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right tabular-nums" style={{ color: '#888' }}>{s.leads}</td>
                    <td className="py-3 text-right font-semibold tabular-nums" style={{ color: '#00e676' }}>{s.wonCount}</td>
                    <td className="py-3 text-right font-semibold tabular-nums" style={{ color: '#00e676' }}>
                      {formatCurrencyCompact(s.revenue)}
                    </td>
                    <td className="py-3 text-right tabular-nums" style={{ color: '#40a0ff' }}>
                      {formatCurrencyCompact(s.forecast)}
                    </td>
                    <td className="py-3 text-right tabular-nums" style={{ color: '#ff4444' }}>
                      {formatCurrencyCompact(s.loss)}
                    </td>
                    <td className="py-3 text-right tabular-nums" style={{ color: '#aaa' }}>
                      {formatCurrencyCompact(s.avgTicket)}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          s.convRate >= 50
                            ? { background: 'rgba(0,230,118,0.1)', color: '#00e676' }
                            : s.convRate >= 20
                            ? { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#555' }
                        }>
                        {s.convRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totais */}
            <div className="mt-4 pt-3 grid grid-cols-3 gap-4 text-xs" style={{ borderTop: '1px solid #1a1a1a' }}>
              <div>
                <p className="uppercase tracking-wide" style={{ color: '#555' }}>Receita Total</p>
                <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#00e676' }}>
                  {formatCurrency(sellers.reduce((sum, s) => sum + s.revenue, 0))}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide" style={{ color: '#555' }}>Previsão Total</p>
                <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#40a0ff' }}>
                  {formatCurrency(sellers.reduce((sum, s) => sum + s.forecast, 0))}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide" style={{ color: '#555' }}>Perdas Total</p>
                <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#ff4444' }}>
                  {formatCurrency(sellers.reduce((sum, s) => sum + s.loss, 0))}
                </p>
              </div>
            </div>
          </div>
        )}
      </DarkCard>

      {/* Funil + Campanhas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <DarkCard>
          <SectionTitle icon={Kanban} title="Distribuição do Funil" />
          {funnelLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : funnel.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#444' }}>Pipeline vazio</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="stageName" tick={{ fontSize: 11, fill: '#aaa' }}
                    axisLine={false} tickLine={false}
                    interval={0}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 10) + '…' : v} />
                  <YAxis tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [`${v} leads`, '']}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#e8e8e8' }}
                    labelStyle={{ color: '#e8e8e8' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {funnel.map((entry) => (
                      <Cell key={entry.stageId} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-3">
                {funnel.map((s) => (
                  <div key={s.stageId} className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5"
                    style={{ background: '#0f0f0f' }}>
                    <div className="flex items-center gap-2" style={{ color: '#e8e8e8' }}>
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.stageName}</span>
                      <span className="font-bold tabular-nums px-2 py-0.5 rounded-full text-xs"
                        style={{ background: `${s.color}22`, color: s.color }}>
                        {s.count}
                      </span>
                    </div>
                    {s.totalValue > 0 && (
                      <span className="font-semibold tabular-nums text-xs"
                        style={{ color: s.stageType === 'won' ? '#00e676' : s.stageType === 'lost' ? '#ff4444' : '#40a0ff' }}>
                        {formatCurrencyCompact(s.totalValue)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DarkCard>

        {/* Campanhas */}
        <DarkCard>
          <SectionTitle icon={Megaphone} title="Performance por Campanha" />
          {campaignsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#444' }}>Nenhuma campanha registrada</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {campaigns.slice(0, 10).map((c, i) => (
                <div key={c.campaign} className="flex items-center gap-3">
                  <span className="text-xs w-4 tabular-nums" style={{ color: '#444' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#e8e8e8' }}>{c.campaign}</p>
                    <div className="h-1.5 w-full rounded-full mt-1" style={{ background: '#1a1a1a' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max((c.leads / (campaigns[0]?.leads || 1)) * 100, 4)}%`,
                          background: 'var(--tenant-primary)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold tabular-nums" style={{ color: '#e8e8e8' }}>{c.leads}</p>
                    <p className="text-[10px]" style={{ color: 'var(--tenant-primary)' }}>{c.convRate}% conv</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DarkCard>
      </div>

      {/* ── Funil de Conversão (horizontal, configurável) ──────────────────── */}
      <DarkCard>
        <SectionTitle icon={Filter} title="Funil de Conversão" />
        <HorizontalFunnel height={200} />
      </DarkCard>

      {/* ── Performance por Pipeline (cada linha = 1 pipeline) ──────────── */}
      <DarkCard>
        <SectionTitle icon={Tag} title="Performance por Pipeline" />
        {pipelinesLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : pipelines.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#666' }}>
            Nenhuma pipeline criada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  {['Pipeline', 'Leads', 'Contatos Feitos', 'Reuniões', 'Conversões', 'Declinaram', 'Tx Reunião', 'Tx Conv.'].map((h, i) => (
                    <th key={h} className={`pb-2 px-2 text-xs font-medium uppercase tracking-wide ${i > 0 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#888' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p) => (
                  <tr key={p.pipelineId} style={{ borderBottom: '1px solid #1a1a1a' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#191919')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="font-medium" style={{ color: '#e8e8e8' }}>{p.pipelineName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums font-semibold" style={{ color: '#e8e8e8' }}>{p.leads}</td>
                    <td className="py-3 px-2 text-right tabular-nums" style={{ color: '#a78bfa' }}>{p.contatosFeitos}</td>
                    <td className="py-3 px-2 text-right tabular-nums" style={{ color: '#40a0ff' }}>{p.reunioes}</td>
                    <td className="py-3 px-2 text-right tabular-nums" style={{ color: '#00e676' }}>{p.conversions}</td>
                    <td className="py-3 px-2 text-right tabular-nums" style={{ color: '#ff4444' }}>{p.declined}</td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(64,160,255,0.12)', color: '#40a0ff' }}>
                        {p.meetingRate}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          p.convRate >= 30
                            ? { background: 'rgba(0,230,118,0.15)', color: '#00e676' }
                            : p.convRate >= 15
                            ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#888' }
                        }>
                        {p.convRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] mt-3" style={{ color: '#666' }}>
              <strong>Contatos Feitos</strong> = cards em etapas tipo "Contato feito" ·{' '}
              <strong>Reuniões</strong> = etapas tipo "Reunião/Em negociação" ·{' '}
              <strong>Conversões/Declinaram</strong> = etapas marcadas como Ganho/Perdido
            </p>
          </div>
        )}
      </DarkCard>

      {/* Breakdown por origem */}
      <DarkCard>
        <SectionTitle icon={ArrowUpRight} title="Leads por Origem" />
        {sourcesLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {sources.map((s, i) => (
              <div key={s.source}
                className="rounded-xl p-3 flex flex-col gap-1 text-center"
                style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                <div className="h-2 w-2 rounded-full mx-auto"
                  style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                <p className="text-xs font-medium capitalize" style={{ color: '#888' }}>
                  {s.source.replace('_', ' ')}
                </p>
                <p className="text-xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{s.leads}</p>
                <p className="text-[10px] font-medium" style={{ color: 'var(--tenant-primary)' }}>
                  {s.convRate}% conv
                </p>
              </div>
            ))}
          </div>
        )}
      </DarkCard>
      </>)}
    </div>
  )
}
