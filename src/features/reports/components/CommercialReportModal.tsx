import { useState } from 'react'
import { ReportBuilder } from '@/components/report/ReportBuilder'
import { ReportTable } from '@/components/report/ReportTable'
import { formatCurrency } from '@/lib/utils'
import type { SellerPerformance, LeadSourceBreakdown, PipelineFunnelData } from '@/services/reports'

/**
 * Relatório comercial imprimível: quem produziu, de onde veio o lead e onde
 * o funil está travando.
 *
 * Usa a mesma moldura do relatório de campanhas — identidade, tema e
 * impressão são do ReportBuilder. Aqui fica só o que é do comercial.
 */

const pct = (n: number) => `${n.toFixed(1)}%`
const int = (n: number) => n.toLocaleString('pt-BR')

export function CommercialReportModal({ open, onClose, empresa, periodo, sellers, sources, funnel }: {
  open:     boolean
  onClose:  () => void
  empresa:  string
  periodo:  string
  sellers:  SellerPerformance[]
  sources:  LeadSourceBreakdown[]
  funnel?:  PipelineFunnelData | null
}) {
  const [incluir, setIncluir] = useState({ vendedores: true, origens: true, funil: true })

  // Totais do time. A taxa de conversão é recalculada sobre os totais —
  // média das taxas individuais daria peso igual a quem trabalhou 3 leads
  // e a quem trabalhou 300.
  const t = sellers.reduce(
    (acc, s) => ({
      leads:   acc.leads   + s.leads,
      won:     acc.won     + s.wonCount,
      lost:    acc.lost    + s.lostCount,
      revenue: acc.revenue + s.revenue,
    }),
    { leads: 0, won: 0, lost: 0, revenue: 0 },
  )
  const fechados = t.won + t.lost
  const convGeral = fechados > 0 ? (t.won / fechados) * 100 : 0
  const ticketMedio = t.won > 0 ? t.revenue / t.won : 0

  const totalLeadsOrigem = sources.reduce((s, o) => s + o.leads, 0)

  const nada = !incluir.vendedores && !incluir.origens && !incluir.funil

  return (
    <ReportBuilder
      open={open} onClose={onClose}
      titulo="Relatório comercial"
      empresa={empresa}
      subtitulo={periodo}
      podeImprimir={!nada}
      destaques={[
        { rotulo: 'Leads no período', valor: int(t.leads) },
        { rotulo: 'Fechamentos',      valor: int(t.won) },
        { rotulo: 'Conversão',        valor: pct(convGeral) },
        { rotulo: 'Receita',          valor: formatCurrency(t.revenue) },
      ]}
      filtros={
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
            Seções do relatório
          </span>
          <div className="flex flex-wrap gap-2">
            {([
              ['vendedores', 'Performance por vendedor'],
              ['origens',    'Origem dos leads'],
              ['funil',      'Funil de conversão'],
            ] as const).map(([chave, rotulo]) => {
              const ativo = incluir[chave]
              return (
                <button key={chave} type="button"
                  onClick={() => setIncluir((v) => ({ ...v, [chave]: !v[chave] }))}
                  aria-pressed={ativo}
                  className="text-xs rounded-lg px-3 py-2 transition-colors"
                  style={{
                    background: ativo ? 'rgba(0,230,118,0.09)' : '#1a1a1a',
                    border: `1px solid ${ativo ? 'var(--tenant-primary)' : '#2a2a2a'}`,
                    color: ativo ? '#e8e8e8' : '#888',
                  }}>
                  {rotulo}
                </button>
              )
            })}
          </div>
        </div>
      }
    >
      {(st) => (
        <>
          {incluir.vendedores && (
            <section>
              <h2 style={st.secaoTitulo}>Performance por vendedor</h2>
              {sellers.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888' }}>Sem dados de vendedores no período.</p>
              ) : (
                <ReportTable
                  st={st} itens={sellers} chaveDoItem={(s) => s.userId}
                  colunas={[
                    { chave: 'nome', rotulo: 'Vendedor', align: 'left', largura: '26%',
                      celula: (s) => s.fullName || s.email, total: '' },
                    { chave: 'leads',  rotulo: 'Leads',       celula: (s) => int(s.leads),    total: int(t.leads) },
                    { chave: 'won',    rotulo: 'Fechados',    celula: (s) => int(s.wonCount), total: int(t.won) },
                    { chave: 'lost',   rotulo: 'Perdidos',    celula: (s) => int(s.lostCount), total: int(t.lost) },
                    { chave: 'conv',   rotulo: 'Conversão',   celula: (s) => pct(s.convRate), total: pct(convGeral) },
                    { chave: 'ticket', rotulo: 'Ticket médio', celula: (s) => formatCurrency(s.avgTicket),
                      total: formatCurrency(ticketMedio) },
                    { chave: 'rev',    rotulo: 'Receita',     celula: (s) => formatCurrency(s.revenue),
                      total: formatCurrency(t.revenue) },
                  ]}
                />
              )}
            </section>
          )}

          {incluir.origens && (
            <section>
              {incluir.vendedores && <div style={st.divisor} />}
              <h2 style={st.secaoTitulo}>Origem dos leads</h2>
              {sources.length === 0 ? (
                <p style={{ fontSize: 12, color: '#888' }}>Sem dados de origem no período.</p>
              ) : (
                <ReportTable
                  st={st} itens={sources} chaveDoItem={(o) => o.source}
                  colunas={[
                    { chave: 'origem', rotulo: 'Origem', align: 'left', largura: '34%',
                      celula: (o) => o.source, total: '' },
                    { chave: 'leads', rotulo: 'Leads', celula: (o) => int(o.leads), total: int(totalLeadsOrigem) },
                    { chave: 'part',  rotulo: 'Participação',
                      celula: (o) => (totalLeadsOrigem > 0 ? pct((o.leads / totalLeadsOrigem) * 100) : '—'),
                      total: totalLeadsOrigem > 0 ? '100,0%' : '—' },
                    { chave: 'conv',  rotulo: 'Conversão', celula: (o) => pct(o.convRate), total: '' },
                  ]}
                />
              )}
            </section>
          )}

          {incluir.funil && funnel && funnel.stages.length > 0 && (
            <section>
              {(incluir.vendedores || incluir.origens) && <div style={st.divisor} />}
              <h2 style={st.secaoTitulo}>Funil de conversão</h2>
              <ReportTable
                st={st} itens={funnel.stages} chaveDoItem={(e) => e.id}
                colunas={[
                  { chave: 'etapa', rotulo: 'Etapa', align: 'left', largura: '34%',
                    celula: (e) => e.name },
                  // "Alcançaram" conta quem passou pela etapa (ou além); "parados
                  // aqui" é quem está travado nela agora. Só o segundo mostra
                  // onde o funil está entupindo.
                  { chave: 'reached', rotulo: 'Alcançaram', celula: (e) => int(e.reached) },
                  { chave: 'parados', rotulo: 'Parados aqui', celula: (e) => int(e.atStage) },
                  { chave: 'doTopo',  rotulo: 'Do topo',   celula: (e) => pct(e.pctOfTop) },
                  { chave: 'daAnt',   rotulo: 'Da anterior', celula: (e) => pct(e.pctOfPrev) },
                ]}
              />
              <p style={{ ...st.comentario, marginTop: 12, fontSize: 10.5, background: 'transparent', border: 'none', padding: 0 }}>
                {int(funnel.entered)} leads entraram · {int(funnel.won)} ganhos
                ({pct(funnel.convRate)}) · {int(funnel.lost)} perdidos · {int(funnel.active)} ainda ativos
              </p>
            </section>
          )}

          {nada && (
            <p style={{ fontSize: 12, color: '#888' }}>
              Nenhuma seção selecionada — escolha ao menos uma acima.
            </p>
          )}
        </>
      )}
    </ReportBuilder>
  )
}
