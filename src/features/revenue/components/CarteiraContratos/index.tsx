import { Repeat, Receipt, TrendingUp, AlertTriangle, Trophy } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'
import { useCarteiraContratos, useProdutosMaisVendidos } from '../../hooks/useContractStats'

/**
 * Composição da carteira e ranking de produtos.
 *
 * Separa recorrente de pagamento único porque são naturezas diferentes: MRR
 * é base que se repete, TCV é venda que acontece uma vez. Somar os dois num
 * número só esconde justamente a informação que decide onde investir.
 */
export function CarteiraContratos({ from, to, periodLabel }: {
  from: string
  to:   string
  periodLabel: string
}) {
  const { data: carteira, isLoading: carteiraLoading } = useCarteiraContratos(from, to)
  const { data: produtos = [], isLoading: prodLoading } = useProdutosMaisVendidos(from, to)

  const maiorTotal  = produtos[0]?.total ?? 0
  const totalGeral  = produtos.reduce((s, p) => s + p.total, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Composição da carteira ─────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="flex items-center gap-2 mb-1">
          <Repeat size={15} style={{ color: 'var(--tenant-primary)' }} />
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Carteira de contratos</p>
        </div>
        <p className="text-xs mb-4" style={{ color: '#444' }}>
          Recorrente é base que se repete; único é venda do período ({periodLabel})
        </p>

        {carteiraLoading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : !carteira ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Bloco
                icone={<Repeat size={13} />}
                rotulo="Recorrentes ativos"
                valor={String(carteira.recorrentesAtivos)}
                sub={`${formatCurrency(carteira.mrr)}/mês`}
                cor="#00e676"
              />
              <Bloco
                icone={<Receipt size={13} />}
                rotulo="Pagamento único"
                valor={String(carteira.unicosNoPeriodo)}
                sub={`${formatCurrency(carteira.tcvNoPeriodo)} fechados`}
                cor="#40a0ff"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Linha
                icone={<TrendingUp size={12} style={{ color: '#00e676' }} />}
                texto="Receita recorrente mensal (MRR)"
                valor={formatCurrency(carteira.mrr)}
                destaque
              />
              {carteira.vencendoEm30Dias > 0 && (
                <Linha
                  icone={<AlertTriangle size={12} style={{ color: '#fbbf24' }} />}
                  texto="Vencem nos próximos 30 dias"
                  valor={String(carteira.vencendoEm30Dias)}
                  cor="#fbbf24"
                />
              )}
              {carteira.pausados > 0 && (
                <Linha texto="Pausados" valor={String(carteira.pausados)} cor="#888" />
              )}
              {carteira.cancelados > 0 && (
                <Linha texto="Cancelados" valor={String(carteira.cancelados)} cor="#666" />
              )}
            </div>

            {carteira.recorrentesAtivos === 0 && carteira.unicosNoPeriodo === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#555' }}>
                Nenhum contrato no período. Lance contratos nos leads para ver a composição aqui.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Produtos mais vendidos ─────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={15} style={{ color: 'var(--tenant-primary)' }} />
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Mais vendidos</p>
        </div>
        <p className="text-xs mb-4" style={{ color: '#444' }}>
          Itens de contrato e compras avulsas, somados ({periodLabel})
        </p>

        {prodLoading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : produtos.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: '#555' }}>
            Nenhuma venda com produto no período. Adicione itens aos contratos para
            ver o ranking.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {produtos.map((p, i) => (
              <div key={`${p.productId ?? p.nome}-${i}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate" style={{ color: i === 0 ? '#e8e8e8' : '#aaa' }}>
                    <span className="tabular-nums mr-1.5" style={{ color: '#555' }}>{i + 1}.</span>
                    {p.nome}
                  </span>
                  <span className="tabular-nums shrink-0 font-medium"
                    style={{ color: i === 0 ? 'var(--tenant-primary)' : '#888' }}>
                    {formatCurrency(p.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: maiorTotal > 0 ? `${(p.total / maiorTotal) * 100}%` : '0%',
                      background: i === 0 ? 'var(--tenant-primary)' : '#2f6f4f',
                    }} />
                </div>
                <span className="text-[10px]" style={{ color: '#555' }}>
                  {p.vendas} {p.vendas === 1 ? 'venda' : 'vendas'}
                  {totalGeral > 0 && ` · ${((p.total / totalGeral) * 100).toFixed(1)}% da receita com produto`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Bloco({ icone, rotulo, valor, sub, cor }: {
  icone: React.ReactNode; rotulo: string; valor: string; sub: string; cor: string
}) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: '#1a1a1a' }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: cor }}>
        {icone}
        <span className="text-[10px] uppercase tracking-wide">{rotulo}</span>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>{valor}</p>
      <p className="text-[11px] tabular-nums" style={{ color: '#666' }}>{sub}</p>
    </div>
  )
}

function Linha({ icone, texto, valor, cor = '#aaa', destaque }: {
  icone?: React.ReactNode; texto: string; valor: string; cor?: string; destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
      style={{ background: destaque ? 'rgba(0,230,118,0.06)' : 'transparent' }}>
      <span className="flex items-center gap-1.5 text-xs" style={{ color: destaque ? '#ccc' : '#888' }}>
        {icone}{texto}
      </span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: destaque ? '#00e676' : cor }}>
        {valor}
      </span>
    </div>
  )
}
