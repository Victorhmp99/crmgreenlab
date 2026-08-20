import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useVendas } from '../../hooks/useContractStats'

/**
 * Categorias que mais vendem no período.
 *
 * Sai da MESMA fonte do ranking de produtos (itens de contrato + compras
 * avulsas), agrupando pela categoria do produto no catálogo. A versão
 * anterior deste card lia a categoria digitada à mão no lançamento
 * financeiro e por isso vivia vazia: contrato fechado não vira lançamento,
 * então nenhuma venda de verdade aparecia ali.
 */

const CORES = ['#00e676', '#40a0ff', '#a78bfa', '#fbbf24', '#ec4899', '#22d3ee', '#f97316', '#84cc16']

interface TooltipPayload { value: number; payload: { categoria: string; vendas: number } }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-xl px-4 py-2.5 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="mb-1" style={{ color: '#aaa' }}>{p.payload.categoria}</p>
      <p className="font-semibold" style={{ color: '#00e676' }}>{formatCurrency(p.value)}</p>
      <p style={{ color: '#666' }}>
        {p.payload.vendas} {p.payload.vendas === 1 ? 'venda' : 'vendas'}
      </p>
    </div>
  )
}

export function CategoriasVendidas({ from, to, periodLabel }: {
  from: string
  to:   string
  periodLabel: string
}) {
  const { data: vendas, isLoading } = useVendas(from, to)

  const categorias = vendas?.categorias ?? []
  const total = categorias.reduce((s, c) => s + c.total, 0)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-1">
        <Layers size={15} style={{ color: 'var(--tenant-primary)' }} />
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Categorias que mais vendem</p>
      </div>
      <p className="text-xs mb-4" style={{ color: '#444' }}>
        {total > 0 ? `${formatCurrency(total)} vendidos em ${periodLabel}` : periodLabel}
      </p>

      {isLoading ? (
        <div className="h-56 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />
      ) : categorias.length === 0 ? (
        <p className="text-xs text-center py-16" style={{ color: '#555' }}>
          Nenhuma venda no período. Vincule produtos do catálogo aos contratos
          para ver quais categorias mais saem.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={categorias}
                dataKey="total"
                nameKey="categoria"
                cx="50%" cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {categorias.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} stroke="#141414" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical" verticalAlign="middle" align="right"
                formatter={(value) => <span className="text-xs" style={{ color: '#888' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-1.5 mt-2">
            {categorias.map((c, i) => (
              <div key={c.categoria} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 truncate" style={{ color: '#aaa' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CORES[i % CORES.length] }} />
                  {c.categoria}
                </span>
                <span className="tabular-nums shrink-0" style={{ color: '#666' }}>
                  {total > 0 ? `${((c.total / total) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
