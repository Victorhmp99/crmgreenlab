import { useState, useMemo } from 'react'
import { Minus, Plus, Target } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { MiniStat } from '../MiniStat'
import { useFinancialProducts } from '../../hooks/useFinancialProducts'
import { calcMargin } from '@/services/financialProducts'
import { formatCurrency } from '@/lib/utils'

type GoalType = 'revenue' | 'profit'
type CalcMode = 'single' | 'mix'

const GOAL_TYPE_OPTIONS = [
  { value: 'revenue', label: 'Receita' },
  { value: 'profit',  label: 'Lucro' },
]

const MODE_OPTIONS: { value: CalcMode; label: string }[] = [
  { value: 'single', label: 'Um serviço' },
  { value: 'mix',    label: 'Mix de produtos' },
]

export function GoalCalculator() {
  const { data: products = [], isLoading } = useFinancialProducts()
  const [calcMode, setCalcMode]   = useState<CalcMode>('single')
  const [goalType, setGoalType]   = useState<GoalType>('revenue')
  const [goalValue, setGoalValue] = useState('')
  const [singleProductId, setSingleProductId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const goal = Number(goalValue) || 0

  const totals = useMemo(() => {
    let revenue = 0
    let cost    = 0
    for (const p of products) {
      const qty = quantities[p.id] ?? 0
      revenue += (p.default_price ?? 0) * qty
      cost    += (p.cost_price ?? 0) * qty
    }
    return { revenue, cost, profit: revenue - cost }
  }, [products, quantities])

  const achieved  = goalType === 'revenue' ? totals.revenue : totals.profit
  const pct       = goal > 0 ? Math.round((achieved / goal) * 100) : 0
  const remaining = Math.max(0, goal - achieved)

  function setQty(id: string, qty: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, qty) }))
  }

  const productOptions = products.map((p) => ({ value: p.id, label: p.name }))
  const singleProduct   = products.find((p) => p.id === singleProductId) ?? null
  const singleMargin    = singleProduct ? calcMargin(singleProduct.default_price, singleProduct.cost_price) : null

  const unitValue = singleProduct
    ? (goalType === 'revenue'
      ? singleProduct.default_price
      : (singleProduct.default_price != null && singleProduct.cost_price != null
        ? singleProduct.default_price - singleProduct.cost_price
        : null))
    : null

  const qtyNeeded = unitValue != null && unitValue > 0 && goal > 0
    ? Math.ceil(goal / unitValue)
    : null

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center gap-2 mb-1">
        <Target size={15} style={{ color: 'var(--tenant-primary)' }} />
        <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Calculadora de Meta</p>
      </div>
      <p className="text-xs mb-4" style={{ color: '#444' }}>
        Descubra quantos serviços fechar (ou monte um mix) pra bater uma meta de receita ou lucro
      </p>

      <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: '#1a1a1a', width: 'fit-content' }}>
        {MODE_OPTIONS.map((m) => (
          <button key={m.value} onClick={() => setCalcMode(m.value)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ background: calcMode === m.value ? 'var(--tenant-primary)' : 'transparent', color: calcMode === m.value ? '#000' : '#888' }}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 items-end mb-5 flex-wrap">
        <div className="w-36">
          <Select label="Meta de" value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)} options={GOAL_TYPE_OPTIONS} />
        </div>
        <div className="w-44">
          <Input label="Valor da meta (R$)" type="number" min="0" placeholder="Ex: 20000"
            value={goalValue} onChange={(e) => setGoalValue(e.target.value)} />
        </div>
        {calcMode === 'single' && (
          <div className="w-56">
            <Select label="Serviço" value={singleProductId}
              onChange={(e) => setSingleProductId(e.target.value)}
              options={productOptions} placeholder="Selecionar..." />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#1a1a1a' }} />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: '#555' }}>
          Cadastre produtos/serviços no Catálogo pra usar a calculadora.
        </p>
      ) : calcMode === 'single' ? (
        <div>
          {!singleProduct ? (
            <p className="text-xs text-center py-8" style={{ color: '#555' }}>Selecione um serviço acima.</p>
          ) : goal <= 0 ? (
            <p className="text-xs text-center py-8" style={{ color: '#555' }}>Defina o valor da meta acima.</p>
          ) : goalType === 'profit' && (singleProduct.cost_price == null) ? (
            <p className="text-xs text-center py-8" style={{ color: '#fbbf24' }}>
              Esse produto não tem custo cadastrado — não dá pra calcular meta de lucro. Cadastre o custo no Catálogo.
            </p>
          ) : qtyNeeded != null ? (
            <div className="flex flex-col items-center gap-3 py-6 rounded-xl"
              style={{ background: '#1a1a1a' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                Pra bater {formatCurrency(goal)} de {goalType === 'revenue' ? 'receita' : 'lucro'} vendendo <strong style={{ color: '#e8e8e8' }}>{singleProduct.name}</strong>:
              </p>
              <p className="text-4xl font-bold tabular-nums" style={{ color: 'var(--tenant-primary)' }}>
                {qtyNeeded} <span className="text-base font-medium" style={{ color: '#888' }}>unidades</span>
              </p>
              <div className="flex gap-4 text-xs" style={{ color: '#666' }}>
                <span>{formatCurrency(singleProduct.default_price ?? 0)}/un</span>
                {singleMargin != null && <span>Margem {singleMargin}%</span>}
                <span>Total: {formatCurrency((singleProduct.default_price ?? 0) * qtyNeeded)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-center py-8" style={{ color: '#555' }}>
              Esse serviço não tem preço cadastrado.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-5">
            {products.map((p) => {
              const qty = quantities[p.id] ?? 0
              const margin = calcMargin(p.default_price, p.cost_price)
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ border: '1px solid #1e1e1e' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#e8e8e8' }}>{p.name}</p>
                    <p className="text-[11px]" style={{ color: '#666' }}>
                      {formatCurrency(p.default_price ?? 0)}
                      {margin != null && ` · margem ${margin}%`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setQty(p.id, qty - 1)} disabled={qty === 0}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                      style={{ background: '#1a1a1a', color: '#888' }}>
                      <Minus size={12} />
                    </button>
                    <input
                      type="number" min="0" value={qty}
                      onChange={(e) => setQty(p.id, Number(e.target.value) || 0)}
                      className="w-11 h-7 text-center rounded-lg text-sm tabular-nums"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8' }}
                    />
                    <button onClick={() => setQty(p.id, qty + 1)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: '#1a1a1a', color: '#888' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-24 text-right shrink-0"
                    style={{ color: qty > 0 ? '#00e676' : '#444' }}>
                    {formatCurrency((p.default_price ?? 0) * qty)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat label="Receita simulada" value={formatCurrency(totals.revenue)} color="#00e676" />
            <MiniStat label="Custo total" value={formatCurrency(totals.cost)} color="#ff4444" />
            <MiniStat label="Lucro projetado" value={formatCurrency(totals.profit)} color="#40a0ff" />
          </div>

          {goal > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span style={{ color: '#888' }}>{Math.max(0, pct)}% da meta de {goalType === 'revenue' ? 'receita' : 'lucro'}</span>
                {remaining > 0
                  ? <span style={{ color: '#666' }}>Faltam {formatCurrency(remaining)}</span>
                  : <span style={{ color: '#00e676' }}>Meta atingida 🎯</span>}
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    background: pct >= 100 ? '#00e676' : 'var(--tenant-primary)',
                  }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
