import { useState, useMemo } from 'react'
import { Check } from 'lucide-react'
import type { Campaign } from '@/services/metaAds'
import { ReportBuilder } from '@/components/report/ReportBuilder'
import { ReportTable, type ColunaRelatorio } from '@/components/report/ReportTable'
import {
  META_COLUMNS, somarTotais, totalDaColuna, formatBRL, type ColumnKey,
} from '../metaColumns'

/** Relatório de campanhas do Meta Ads. */
export function ReportModal({ open, onClose, campaigns, colunas, periodo, conta, empresa }: {
  open:      boolean
  onClose:   () => void
  campaigns: Campaign[]
  colunas:   ColumnKey[]
  periodo:   string
  conta:     string
  empresa:   string
}) {
  // null = ainda não mexeu, então vale "todas". Guardar como lista de ids
  // evita dessincronizar quando a sincronização traz campanhas novas com o
  // modal aberto.
  const [somenteEstas, setSomenteEstas] = useState<string[] | null>(null)

  const selecionadas = useMemo(
    () => (somenteEstas === null ? campaigns : campaigns.filter((c) => somenteEstas.includes(c.id))),
    [campaigns, somenteEstas],
  )

  const totais   = somarTotais(selecionadas)
  const visiveis = META_COLUMNS.filter((c) => c.fixed || colunas.includes(c.key))
  const comGasto = campaigns.filter((c) => (c.spend ?? 0) > 0).map((c) => c.id)

  function alternar(id: string) {
    const atual = somenteEstas ?? campaigns.map((c) => c.id)
    setSomenteEstas(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id])
  }

  const custoPorResultado = totais.results > 0 ? totais.spend / totais.results : null

  return (
    <ReportBuilder
      open={open} onClose={onClose}
      titulo="Relatório de campanhas"
      empresa={empresa}
      subtitulo={`${conta} · ${periodo}`}
      podeImprimir={selecionadas.length > 0}
      destaques={[
        { rotulo: 'Investido',    valor: formatBRL(totais.spend) },
        { rotulo: 'Resultados',   valor: totais.results.toLocaleString('pt-BR') },
        { rotulo: 'Custo/result.', valor: custoPorResultado ? formatBRL(custoPorResultado) : '—' },
        { rotulo: 'Alcance',      valor: totais.reach.toLocaleString('pt-BR') },
      ]}
      filtros={
        <SeletorDeCampanhas
          campaigns={campaigns} somenteEstas={somenteEstas} selecionadas={selecionadas.length}
          onAlternar={alternar} onTodas={() => setSomenteEstas(null)}
          onComGasto={() => setSomenteEstas(comGasto)} onNenhuma={() => setSomenteEstas([])}
        />
      }
    >
      {(st) => (
        <section>
          <h2 style={st.secaoTitulo}>Campanhas ({selecionadas.length})</h2>
          {selecionadas.length === 0 ? (
            <p style={{ fontSize: 12, color: '#888' }}>Nenhuma campanha selecionada.</p>
          ) : (
            <ReportTable
              st={st}
              itens={selecionadas}
              chaveDoItem={(c) => c.id}
              colunas={visiveis.map<ColunaRelatorio<Campaign>>((col) => ({
                chave:  col.key,
                rotulo: col.label,
                align:  col.align,
                largura: col.key === 'name' ? '19%' : col.key === 'status' ? '8%' : undefined,
                celula: (c) => {
                  if (col.key === 'name') return c.name
                  if (col.key === 'status') {
                    return c.status === 'ACTIVE' ? 'Ativa' : c.status === 'PAUSED' ? 'Pausada' : c.status ?? '—'
                  }
                  const v = col.get(c)
                  return v == null ? '—' : col.format(v)
                },
                total: (() => {
                  const t = totalDaColuna(col, totais)
                  return t == null ? '' : col.format(t)
                })(),
              }))}
            />
          )}
        </section>
      )}
    </ReportBuilder>
  )
}

function SeletorDeCampanhas({ campaigns, somenteEstas, selecionadas, onAlternar, onTodas, onComGasto, onNenhuma }: {
  campaigns: Campaign[]
  somenteEstas: string[] | null
  selecionadas: number
  onAlternar: (id: string) => void
  onTodas: () => void
  onComGasto: () => void
  onNenhuma: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888' }}>
          Campanhas no relatório
          <span className="ml-1.5 normal-case tracking-normal" style={{ color: '#555' }}>
            {selecionadas} de {campaigns.length}
          </span>
        </span>
        <div className="flex gap-3 text-xs">
          <BotaoTexto onClick={onTodas}>Todas</BotaoTexto>
          <BotaoTexto onClick={onComGasto} title="Deixa de fora as campanhas sem investimento no período">
            Só com gasto
          </BotaoTexto>
          <BotaoTexto onClick={onNenhuma}>Nenhuma</BotaoTexto>
        </div>
      </div>

      <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: '1px solid #2a2a2a' }}>
        {campaigns.map((c) => {
          const marcada = somenteEstas === null || somenteEstas.includes(c.id)
          return (
            <button key={c.id} type="button" onClick={() => onAlternar(c.id)}
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
                {(c.spend ?? 0) > 0 ? formatBRL(c.spend ?? 0) : 'sem gasto'}
              </span>
            </button>
          )
        })}
      </div>
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
