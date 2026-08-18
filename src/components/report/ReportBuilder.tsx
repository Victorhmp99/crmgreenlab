import { useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  CORES, ESTILOS, montarEstilos,
  type CorTema, type EstiloTema, type EstilosRelatorio,
} from './theme'

/**
 * Moldura de qualquer relatório imprimível do sistema.
 *
 * Cuida do que é igual em todos — identidade, tema, comentário, cabeçalho,
 * destaques, rodapé e impressão — e deixa o miolo por conta de quem chama.
 * Meta Ads e Comercial usam a mesma moldura: sem isso, os dois documentos
 * iam divergir de aparência na primeira mudança de qualquer um deles.
 *
 * O comentário vem ANTES dos dados de propósito: quem recebe lê a leitura de
 * quem enviou primeiro, e os números como comprovação.
 */

export interface Destaque {
  rotulo: string
  valor:  string
}

export function ReportBuilder({
  open, onClose, titulo: tituloPadrao, empresa, subtitulo,
  destaques = [], children, filtros, podeImprimir = true,
}: {
  open:      boolean
  onClose:   () => void
  titulo:    string
  empresa:   string
  /** Linha de contexto: período, conta, recorte. */
  subtitulo: string
  destaques?: Destaque[]
  /** Miolo do documento — recebe os estilos do tema escolhido. */
  children:  (st: EstilosRelatorio) => ReactNode
  /** Controles extras do modal (seleção de itens, por exemplo). */
  filtros?:  ReactNode
  podeImprimir?: boolean
}) {
  const [titulo, setTitulo]         = useState(tituloPadrao)
  const [marca, setMarca]           = useState(empresa)
  const [comentario, setComentario] = useState('')
  const [cor, setCor]               = useState<CorTema>('verde')
  const [estilo, setEstilo]         = useState<EstiloTema>('corporativo')

  const st = montarEstilos(cor, estilo)
  const emitidoEm = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Modal
      open={open} onClose={onClose}
      title="Gerar relatório"
      description="Escolha o que entra, ajuste a identidade e imprima."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()} disabled={!podeImprimir}>
            <Printer size={15} /> Imprimir / Salvar PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="no-print grid sm:grid-cols-2 gap-3">
          <Campo id="rel-marca" label="Nome no topo (sua marca)" value={marca}
            onChange={setMarca} placeholder="Nome da sua empresa" />
          <Campo id="rel-titulo" label="Título do relatório" value={titulo}
            onChange={setTitulo} placeholder={tituloPadrao} />
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

        {filtros && <div className="no-print">{filtros}</div>}

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

        {/* Container sem padding: cabeçalho, destaques e rodapé sangram de
            ponta a ponta; o respiro fica no miolo (st.corpo). */}
        <div id="relatorio-impressao"
          style={{ ...st.pagina, padding: 0, borderRadius: 8, overflow: 'hidden' }}>
          <header style={st.cabecalho}>
            {marca.trim() && <p style={st.marca}>{marca.trim()}</p>}
            <h1 style={st.titulo}>{titulo || tituloPadrao}</h1>
            <p style={st.subtitulo}>{subtitulo} · emitido em {emitidoEm}</p>
          </header>

          {destaques.length > 0 && (
            <div style={st.destaques}>
              {destaques.map((d, i) => (
                <div key={d.rotulo}
                  style={i === destaques.length - 1 ? { ...st.destaque, borderRight: 'none' } : st.destaque}>
                  <p style={st.destaqueRotulo}>{d.rotulo}</p>
                  <p style={st.destaqueValor}>{d.valor}</p>
                </div>
              ))}
            </div>
          )}

          <div style={st.corpo}>
            {comentario.trim() && (
              <section style={{ marginBottom: 18 }}>
                <h2 style={st.secaoTitulo}>Análise do período</h2>
                <p style={st.comentario}>{comentario.trim()}</p>
              </section>
            )}
            {children(st)}
          </div>

          <footer style={st.rodape}>
            Relatório gerado por {marca.trim() || 'Green Hub'} · Médias e taxas são recalculadas
            sobre os totais do período, não são a média das linhas.
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
