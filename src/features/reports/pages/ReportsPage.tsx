import { useState, useEffect } from 'react'
import { Users, Megaphone, ArrowUpRight, Tag, Filter, FileText, PhoneCall } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchDesempenhoLigacoes } from '@/services/reports'
import { DatePicker } from '@/components/ui/DatePicker'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatCurrencyCompact, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { CommercialReportModal } from '../components/CommercialReportModal'
import { PipelineFunnel } from '../components/PipelineFunnel'
import { usePipelines } from '@/features/pipeline/hooks/usePipelines'
import {
  useSellerPerformance,
  useCampaignPerformance,
  useSourceBreakdown,
  usePipelineBreakdown,
  usePipelineFunnel,
} from '../hooks/useReports'

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

// ── Page ─────────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { from, to } = currentMonthRange()
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo,   setDateTo]   = useState(to)
  const [reportOpen, setReportOpen] = useState(false)
  const tenantName = useAuthStore((s) => s.tenant?.name)

  // Datas vêm como yyyy-mm-dd; no relatório precisam sair legíveis.
  const periodoLabel = `${formatDate(dateFrom)} a ${formatDate(dateTo)}`

  const { data: sellers   = [], isLoading: sellersLoading }   = useSellerPerformance(dateFrom, dateTo)
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaignPerformance()
  const { data: sources   = [], isLoading: sourcesLoading }   = useSourceBreakdown()
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelineBreakdown()

  // Funil preciso por pipeline (etapas reais + etapa atual de cada lead)
  const { data: pipelinesList = [] } = usePipelines()
  const [funnelPipelineId, setFunnelPipelineId] = useState('')
  useEffect(() => {
    if (!funnelPipelineId && pipelinesList.length > 0) setFunnelPipelineId(pipelinesList[0].id)
  }, [pipelinesList, funnelPipelineId])
  const { data: funnelData, isLoading: funnelDataLoading } = usePipelineFunnel(funnelPipelineId || null)

  const tenantId = useAuthStore((s) => s.tenant?.id)
  const { data: ligacoes } = useQuery({
    queryKey: ['desempenho-ligacoes', tenantId, dateFrom, dateTo],
    queryFn:  () => fetchDesempenhoLigacoes(tenantId!, dateFrom, dateTo),
    enabled:  !!tenantId,
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#e8e8e8' }}>Relatórios</h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>Performance por vendedor e canal</p>
        </div>

        <div className="flex items-end gap-2 flex-wrap justify-end">
          <DatePicker label="De" placeholder="Data início" className="w-36"
            value={dateFrom} onChange={setDateFrom} />
          <DatePicker label="Até" placeholder="Data fim" className="w-36"
            value={dateTo} onChange={setDateTo} />
          <Button variant="secondary" onClick={() => setReportOpen(true)}>
            <FileText size={15} /> Relatório
          </Button>
        </div>
      </div>

      <CommercialReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        empresa={tenantName ?? 'Relatório comercial'}
        periodo={periodoLabel}
        sellers={sellers}
        sources={sources}
        funnel={funnelData}
      />

      {(<>

      {/* Ligações — o número que a operação não tinha antes de existir o
          registro de um toque no lead. */}
      <DarkCard>
        <SectionTitle icon={PhoneCall} title="Ligações" />
        {!ligacoes || ligacoes.total === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: '#555' }}>
            Nenhuma ligação registrada no período. Registre pelo card do lead, ao lado do
            telefone — é um clique, e é o que permite medir sua taxa de atendimento.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <NumeroLigacoes rotulo="Taxa de atendimento"
                valor={`${ligacoes.taxaAtendimento.toFixed(0)}%`} cor="#00e676"
                sub={`${ligacoes.atendidas} de ${ligacoes.total} discadas`} />
              <NumeroLigacoes rotulo="Não atenderam"
                valor={String(ligacoes.naoAtendidas)} cor="#fbbf24" sub="tentar outro horário" />
              <NumeroLigacoes rotulo="Caixa postal"
                valor={String(ligacoes.caixaPostal)} cor="#a78bfa" sub="número certo, sem resposta" />
              <NumeroLigacoes rotulo="Número errado"
                valor={String(ligacoes.numeroErrado)} cor="#ff4444" sub="problema de cadastro" />
            </div>

            {ligacoes.minutosAteContato != null && (
              <p className="text-xs mt-4" style={{ color: '#666' }}>
                Da entrada do lead até a primeira ligação:{' '}
                <strong style={{ color: ligacoes.minutosAteContato <= 30 ? '#00e676' : '#fbbf24' }}>
                  {ligacoes.minutosAteContato < 60
                    ? `${Math.round(ligacoes.minutosAteContato)} min`
                    : `${(ligacoes.minutosAteContato / 60).toFixed(1)} h`}
                </strong>{' '}
                (mediana). Quanto mais perto do momento em que a pessoa preencheu, maior a
                chance de ela lembrar e atender.
              </p>
            )}
          </>
        )}
      </DarkCard>

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

      {/* ── Funil da Pipeline (preciso — usa as etapas reais) ──────────────── */}
      <DarkCard>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Funil da Pipeline</h3>
          </div>
          {pipelinesList.length > 0 && (
            <div className="w-56">
              <Select
                value={funnelPipelineId}
                onChange={(e) => setFunnelPipelineId(e.target.value)}
                options={pipelinesList.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}
        </div>
        {funnelDataLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !funnelData || funnelData.entered === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#444' }}>
            {pipelinesList.length === 0 ? 'Nenhuma pipeline criada ainda.' : 'Sem leads nesta pipeline ainda.'}
          </p>
        ) : (
          <PipelineFunnel data={funnelData} />
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

      {/* ── Performance por Pipeline — resumo de cada pipeline ───────────── */}
      <DarkCard>
        <SectionTitle icon={Tag} title="Performance por Pipeline" />
        {pipelinesLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : pipelines.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#666' }}>
            Nenhuma pipeline criada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pipelines.map((p) => (
              <PipelineBreakdownRow key={p.pipelineId} pipeline={p} />
            ))}
            <p className="text-[11px] leading-relaxed" style={{ color: '#666' }}>
              <em>Cada pipeline mostra suas próprias etapas — quantos leads já passaram por cada uma
              (não só os que estão nela agora). Onde a barra encolhe muito é onde o comercial mais perde.</em>
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

// ── Linha "Performance por Pipeline" ──────────────────────────────────────────
// Mostra as ETAPAS REAIS da pipeline como mini-funil (leads que já passaram por
// cada uma, com % do topo e % que avançou da anterior). Sem depender de nenhuma
// configuração de "passos do funil".
function PipelineBreakdownRow({ pipeline }: {
  pipeline: {
    pipelineId: string; pipelineName: string; color: string
    leads: number; conversions: number; declined: number; convRate: number
    stages: Array<{ name: string; reached: number; pctOfTop: number; pctOfPrev: number }>
  }
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      {/* Cabeçalho da pipeline */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pipeline.color }} />
          <span className="text-sm font-semibold truncate" style={{ color: '#e8e8e8' }}>{pipeline.pipelineName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span style={{ color: '#888' }}>
            <strong style={{ color: '#e8e8e8' }}>{pipeline.leads}</strong> leads
          </span>
          <span style={{ color: '#888' }}>
            <strong style={{ color: '#00e676' }}>{pipeline.conversions}</strong> convertidos
          </span>
          {pipeline.declined > 0 && (
            <span style={{ color: '#888' }}>
              <strong style={{ color: '#ff5555' }}>{pipeline.declined}</strong> perdidos
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 font-semibold tabular-nums"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
            {pipeline.convRate}% conv
          </span>
        </div>
      </div>

      {/* Mini-funil das etapas reais */}
      {pipeline.stages.length === 0 || pipeline.leads === 0 ? (
        <p className="text-xs py-1" style={{ color: '#555' }}>Sem leads nesta pipeline ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
          {pipeline.stages.map((s, i) => {
            const w = Math.max(s.pctOfTop, 6)
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] shrink-0 truncate" style={{ width: 96, color: '#aaa' }}>{s.name}</span>
                <div className="flex-1 h-4 rounded-sm relative overflow-hidden" style={{ background: '#151515' }}>
                  <div className="h-full rounded-sm transition-all"
                    style={{ width: `${w}%`, background: `${pipeline.color}55`, borderRight: `1px solid ${pipeline.color}` }} />
                </div>
                <span className="text-[11px] shrink-0 tabular-nums text-right" style={{ width: 40, color: '#e8e8e8' }}>
                  {s.reached}
                </span>
                <span className="text-[10px] shrink-0 tabular-nums text-right" style={{ width: 36, color: '#666' }}>
                  {s.pctOfTop}%
                </span>
                {i > 0 && (
                  <span className="text-[10px] shrink-0 tabular-nums text-right"
                    style={{ width: 44, color: s.pctOfPrev < 40 ? '#ff6b6b' : '#666' }}
                    title="% que avançou da etapa anterior">
                    ↓{s.pctOfPrev}%
                  </span>
                )}
                {i === 0 && <span className="shrink-0" style={{ width: 44 }} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NumeroLigacoes({ rotulo, valor, cor, sub }: {
  rotulo: string; valor: string; cor: string; sub: string
}) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: '#1a1a1a' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#666' }}>{rotulo}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: cor }}>{valor}</p>
      <p className="text-[11px]" style={{ color: '#555' }}>{sub}</p>
    </div>
  )
}
