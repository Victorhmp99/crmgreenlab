import { useState, useMemo } from 'react'
import { Printer, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Campaign } from '@/services/metaAds'
import {
  META_COLUMNS, somarTotais, totalDaColuna, type ColumnKey,
} from '../metaColumns'
import {
  CORES, ESTILOS, montarEstilos, type CorTema, type EstiloTema,
} from '../reportThemes'

/**
 * Relatório imprimível das campanhas.
 *
 * O comentário vem ANTES da tabela de propósito: quem recebe lê a leitura do
 * gestor primeiro e os números como comprovação — número solto não conta
 * história.
 *
 * A impressão usa o próprio navegador. O CSS `@media print` em index.css
 * isola `#relatorio-impressao` do resto da aplicação.
 */
export function ReportModal({ open, onClose, campaigns, colunas, periodo, conta, empresa }: {
  open:      boolean
  onClose:   () => void
  campaigns: Campaign[]
  colunas:   ColumnKey[]
  periodo:   string
  conta:     string
  empresa:   string
}) {
  const [titulo, setTitulo]         = useState('Relatório de campanhas')
  const [marca, setMarca]           = useState(empresa)
  const [comentario, setComentario] = useState('')
  const [cor, setCor]               = useState<CorTema>('verde')
  const [estilo, setEstilo]         = useState<EstiloTema>('corporativo')
  // null = ainda não mexeu, então vale "todas". Guardar a seleção como lista
  // de ids evita ficar dessincronizado quando a sincronização traz campanhas
  // novas enquanto o modal está aberto.
  const [somenteEstas, setSomenteEstas] = useState<string[] | null>(null)

  const selecionadas = useMemo(
    () => (somenteEstas === null ? campaigns : campaigns.filter((c) => somenteEstas.includes(c.id))),
    [campaigns, somenteEstas],
  )

  const st        = montarEstilos(cor, estilo)
  const totais    = somarTotais(selecionadas)
  const visiveis  = META_COLUMNS.filter((c) => c.fixed || colunas.includes(c.key))
  const emitidoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  function alternarCampanha(id: string) {
    const atual = somenteEstas ?? campaigns.map((c) => c.id)
    setSomenteEstas(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id])
  }

  const comGasto = campaigns.filter((c) => (c.spend ?? 0) > 0).map((c) => c.id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar relatório"
      description="Escolha o que entra, ajuste a identidade e imprima."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()} disabled={selecionadas.length === 0}>
            <Printer size={15} /> Imprimir / Salvar PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ── Identidade ────────────────────────────────────────────────── */}
        <div className="no-print grid sm:grid-cols-2 gap-3">
          <Campo id="rel-marca" label="Nome no topo (sua marca)" value={marca} onChange={setMarca}
            placeholder="Nome da sua empresa" />
          <Campo id="rel-titulo" label="Título do relatório" value={titulo} onChange={setTitulo}
            placeholder="Relatório de campanhas" />
        </div>

        <div className="no-print flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Cor</span>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button key={c.key} type="button" onClick={() => setCor(c.key)}
                aria-pressed={cor === c.key} title={c.label}
                className="h-9 w-9 rounded-lg transition-transform"
                style={{
                  background: c.hex,
                  border: cor === c.key ? '2px solid #fff' : '2px solid transparent',
                  outline: cor === c.key ? `2px solid ${c.hex}` : 'none',
                  transform: cor === c.key ? 'scale(1.06)' : 'none',
                }} />
            ))}
          </div>
        </div>

        <div className="no-print flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>Estilo</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ESTILOS.map((e) => {
              const ativo = estilo === e.key
              return (
                <button key={e.key} type="button" onClick={() => setEstilo(e.key)} aria-pressed={ativo}
                  className="rounded-lg px-3 py-2.5 text-left transition-colors"
                  style={{
                    background: ativo ? 'rgba(0,230,118,0.08)' : '#1a1a1a',
                    border: `1px solid ${ativo ? 'var(--tenant-primary)' : '#2a2a2a'}`,
                  }}>
                  <span className="text-xs font-semibold block" style={{ color: ativo ? '#e8e8e8' : '#aaa' }}>
                    {e.label}
                  </span>
                  <span className="text-[10px] block leading-snug mt-0.5" style={{ color: '#666' }}>{e.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Campanhas ─────────────────────────────────────────────────── */}
        <div className="no-print flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
              Campanhas no relatório
              <span className="ml-1.5 normal-case tracking-normal" style={{ color: '#555' }}>
                {selecionadas.length} de {campaigns.length}
              </span>
            </span>
            <div className="flex gap-3 text-xs">
              <BotaoTexto onClick={() => setSomenteEstas(null)}>Todas</BotaoTexto>
              <BotaoTexto onClick={() => setSomenteEstas(comGasto)}
                title="Deixa de fora as campanhas sem investimento no período">
                Só com gasto
              </BotaoTexto>
              <BotaoTexto onClick={() => setSomenteEstas([])}>Nenhuma</BotaoTexto>
            </div>
          </div>

          <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: '1px solid #2a2a2a' }}>
            {campaigns.map((c) => {
              const marcada = somenteEstas === null || somenteEstas.includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => alternarCampanha(c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{ borderBottom: '1px solid #191919' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span className="h-4 w-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: marcada ? 'var(--tenant-primary)' : 'transparent',
                      border: `1px solid ${marcada ? 'var(--tenant-primary)' : '#3a3a3a'}`,
                    }}>
                    {marcada && <Check size={11} style={{ color: '#04120a' }} />}
                  </span>
                  <span className="text-xs truncate flex-1" style={{ color: marcada ? '#e8e8e8' : '#777' }}>
                    {c.name}
                  </span>
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: '#555' }}>
                    {(c.spend ?? 0) > 0
                      ? (c.spend ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'sem gasto'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Comentário ────────────────────────────────────────────────── */}
        <div className="no-print flex flex-col gap-1.5">
          <label htmlFor="rel-comentario" className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#888' }}>
            Comentário / análise
          </label>
          <textarea id="rel-comentario" rows={4} value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="O que aconteceu no período, o que explica os números e o que será feito a seguir."
            className="rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }} />
        </div>

        <p className="text-xs no-print" style={{ color: '#555' }}>
          Pré-visualização — é exatamente isto que sai na impressão.
        </p>

        {/* ── Documento ─────────────────────────────────────────────────── */}
        <div id="relatorio-impressao" style={{ ...st.pagina, padding: 28, borderRadius: 8 }}>
          <header style={st.cabecalho}>
            {marca.trim() && <p style={st.marca}>{marca.trim()}</p>}
            <h1 style={st.titulo}>{titulo || 'Relatório de campanhas'}</h1>
            <p style={st.subtitulo}>{conta} · {periodo} · emitido em {emitidoEm}</p>
          </header>

          {comentario.trim() && (
            <section style={{ marginBottom: 20 }}>
              <h2 style={st.secaoTitulo}>Análise do período</h2>
              <p style={st.comentario}>{comentario.trim()}</p>
            </section>
          )}

          <section>
            <h2 style={st.secaoTitulo}>Campanhas ({selecionadas.length})</h2>

            {selecionadas.length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>Nenhuma campanha selecionada.</p>
            ) : (
              <table style={st.tabela}>
                <thead>
                  <tr>
                    {visiveis.map((col) => (
                      <th key={col.key} style={{ ...st.th, textAlign: col.align }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selecionadas.map((c, i) => (
                    <tr key={c.id} style={i % 2 === 1 ? st.linhaPar : undefined}>
                      {visiveis.map((col) => {
                        if (col.key === 'name') {
                          return <td key={col.key} style={{ ...st.td, textAlign: 'left' }}>{c.name}</td>
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key} style={{ ...st.td, textAlign: 'left' }}>
                              {c.status === 'ACTIVE' ? 'Ativa' : c.status === 'PAUSED' ? 'Pausada' : c.status ?? '—'}
                            </td>
                          )
                        }
                        const v = col.get(c)
                        return (
                          <td key={col.key} style={{ ...st.td, textAlign: col.align }}>
                            {v == null ? '—' : col.format(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={st.linhaTotal}>
                    {visiveis.map((col, i) => {
                      if (i === 0) return <td key={col.key} style={{ ...st.td, textAlign: 'left' }}>Total</td>
                      const t = totalDaColuna(col, totais)
                      return (
                        <td key={col.key} style={{ ...st.td, textAlign: col.align }}>
                          {t == null ? '' : col.format(t)}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          <footer style={st.rodape}>
            Médias (CTR, CPC, CPM, frequência e custo por resultado) são recalculadas sobre os
            totais do período — não são a média das campanhas.
          </footer>
        </div>
      </div>
    </Modal>
  )
}

function Campo({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
        {label}
      </label>
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg px-3 text-sm focus:outline-none"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }} />
    </div>
  )
}

function BotaoTexto({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="transition-colors" style={{ color: '#777' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tenant-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}>
      {children}
    </button>
  )
}
