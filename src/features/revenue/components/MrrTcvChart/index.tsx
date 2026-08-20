import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { CarteiraContratos } from '@/services/contractStats'

/**
 * MRR × TCV — de que tipo é o dinheiro que está entrando.
 *
 * São naturezas diferentes: MRR é base que se repete todo mês sem precisar
 * vender de novo; TCV é venda pontual que precisa ser reposta. Uma empresa
 * com 80% do faturamento em TCV depende de vender sempre; uma com 80% em
 * MRR tem colchão pros meses fracos. Somar os dois num gráfico de categoria
 * escondia justamente essa leitura.
 */

const COR_MRR = '#00e676'
const COR_TCV = '#40a0ff'

interface TooltipPayload { name: string; value: number }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-xl px-4 py-2.5 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="mb-1" style={{ color: '#aaa' }}>{p.name}</p>
      <p className="font-semibold" style={{ color: p.name === 'MRR' ? COR_MRR : COR_TCV }}>
        {formatCurrency(p.value)}
      </p>
    </div>
  )
}

export function MrrTcvChart({ carteira, periodLabel }: {
  carteira:    CarteiraContratos | undefined
  periodLabel: string
}) {
  const mrr = carteira?.mrr ?? 0
  const tcv = carteira?.tcvNoPeriodo ?? 0
  const total = mrr + tcv

  const data = [
    { name: 'MRR', value: mrr },
    { name: 'TCV', value: tcv },
  ].filter((d) => d.value > 0)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>MRR × TCV</p>
      <p className="text-xs mt-0.5 mb-4" style={{ color: '#444' }}>
        {total > 0
          ? `Recorrente vs. pagamento único · ${periodLabel}`
          : 'Recorrente vs. pagamento único'}
      </p>

      {total === 0 ? (
        <p className="text-xs text-center py-16" style={{ color: '#555' }}>
          Nenhum contrato recorrente ativo nem venda única no período.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.name === 'MRR' ? COR_MRR : COR_TCV}
                    stroke="#141414" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs" style={{ color: '#888' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide" style={{ color: COR_MRR }}>MRR</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#e8e8e8' }}>
                {total > 0 ? `${Math.round((mrr / total) * 100)}%` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide" style={{ color: COR_TCV }}>TCV</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#e8e8e8' }}>
                {total > 0 ? `${Math.round((tcv / total) * 100)}%` : '—'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
