import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Campaign } from '@/services/metaAds'
import {
  META_COLUMNS, somarTotais, totalDaColuna, type ColumnKey,
} from '../metaColumns'

/**
 * Relatório imprimível das campanhas.
 *
 * O comentário vem ANTES da tabela de propósito: quem recebe o relatório lê
 * a leitura do gestor primeiro e os números como comprovação — número solto
 * não conta história.
 *
 * A impressão usa o próprio navegador (window.print). O CSS `@media print`
 * em index.css esconde o resto da aplicação e deixa só `#relatorio-impressao`,
 * em fundo branco: relatório é feito pra virar PDF ou papel, e o tema escuro
 * gastaria tinta e sairia ilegível.
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
  const [comentario, setComentario] = useState('')
  const [titulo, setTitulo] = useState('Relatório de campanhas')

  const totais = somarTotais(campaigns)
  const visiveis = META_COLUMNS.filter((c) => c.fixed || colunas.includes(c.key))

  const emitidoEm = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gerar relatório"
      description="Escreva sua leitura do período — ela abre o relatório, antes dos números."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => window.print()} disabled={campaigns.length === 0}>
            <Printer size={15} /> Imprimir / Salvar PDF
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 no-print">
          <label htmlFor="rel-titulo" className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#888' }}>
            Título do relatório
          </label>
          <input id="rel-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
            className="h-10 rounded-lg px-3 text-sm focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }} />
        </div>

        <div className="flex flex-col gap-1.5 no-print">
          <label htmlFor="rel-comentario" className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#888' }}>
            Comentário / análise
          </label>
          <textarea
            id="rel-comentario"
            rows={5}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="O que aconteceu no período, o que explica os números e o que será feito a seguir."
            className="rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
          />
          <p className="text-xs" style={{ color: '#555' }}>
            Aparece no topo do relatório impresso. Deixe em branco para omitir.
          </p>
        </div>

        <p className="text-xs no-print" style={{ color: '#555' }}>
          Pré-visualização — é exatamente isto que sai na impressão.
        </p>

        {/* Área impressa: fundo claro mesmo no tema escuro, porque vira papel/PDF */}
        <div id="relatorio-impressao" className="rounded-lg p-6"
          style={{ background: '#fff', color: '#111' }}>
          <header style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{titulo}</h1>
            <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0' }}>
              {empresa} · {conta} · {periodo} · emitido em {emitidoEm}
            </p>
          </header>

          {comentario.trim() && (
            <section style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', margin: '0 0 6px' }}>
                Análise do período
              </h2>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {comentario.trim()}
              </p>
            </section>
          )}

          <section>
            <h2 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', margin: '0 0 8px' }}>
              Campanhas ({campaigns.length})
            </h2>

            {campaigns.length === 0 ? (
              <p style={{ fontSize: 13, color: '#777' }}>Nenhuma campanha no recorte selecionado.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #999' }}>
                    {visiveis.map((col) => (
                      <th key={col.key}
                        style={{
                          textAlign: col.align, padding: '6px 5px',
                          fontWeight: 600, whiteSpace: 'nowrap', color: '#333',
                        }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #e2e2e2' }}>
                      {visiveis.map((col) => {
                        if (col.key === 'name') {
                          return <td key={col.key} style={{ padding: '6px 5px', maxWidth: 200 }}>{c.name}</td>
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key} style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>
                              {c.status === 'ACTIVE' ? 'Ativa' : c.status === 'PAUSED' ? 'Pausada' : c.status ?? '—'}
                            </td>
                          )
                        }
                        const v = col.get(c)
                        return (
                          <td key={col.key}
                            style={{ padding: '6px 5px', textAlign: col.align, whiteSpace: 'nowrap' }}>
                            {v == null ? '—' : col.format(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #111', fontWeight: 700 }}>
                    {visiveis.map((col, i) => {
                      if (i === 0) return <td key={col.key} style={{ padding: '7px 5px' }}>Total</td>
                      const t = totalDaColuna(col, totais)
                      return (
                        <td key={col.key}
                          style={{ padding: '7px 5px', textAlign: col.align, whiteSpace: 'nowrap' }}>
                          {t == null ? '' : col.format(t)}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          <footer style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ddd', fontSize: 10, color: '#777' }}>
            Médias (CTR, CPC, CPM, frequência e custo por resultado) são recalculadas sobre os
            totais do período — não são a média das campanhas.
          </footer>
        </div>
      </div>
    </Modal>
  )
}
