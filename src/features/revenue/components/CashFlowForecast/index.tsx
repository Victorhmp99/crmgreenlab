import { useState, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useCashFlowForecast } from '../../hooks/useFinancial'
import { MiniStat } from '../MiniStat'
import { DatePicker } from '@/components/ui/DatePicker'
import { formatCurrency } from '@/lib/utils'

type Mode = '30' | '60' | '90' | 'month' | 'custom'

const PRESETS: { mode: Mode; label: string }[] = [
  { mode: '30',    label: '30d' },
  { mode: '60',    label: '60d' },
  { mode: '90',    label: '90d' },
  { mode: 'month', label: 'Mês atual' },
  { mode: 'custom', label: 'Personalizado' },
]

function formatK(value: number): string {
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(0)}k`
  return `R$${value.toFixed(0)}`
}

interface TooltipPayload { value: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-2.5 text-xs"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      <p className="mb-1" style={{ color: '#666' }}>{label}</p>
      <p className="font-semibold" style={{ color: payload[0].value >= 0 ? '#00e676' : '#ff4444' }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

function daysUntilEndOfMonth(): number {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 86_400_000))
}

export function CashFlowForecast() {
  const [mode, setMode] = useState<Mode>('30')
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })

  const days = useMemo(() => {
    if (mode === '30') return 30
    if (mode === '60') return 60
    if (mode === '90') return 90
    if (mode === 'month') return daysUntilEndOfMonth()
    // custom: diferença entre hoje e a data escolhida
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(customDate + 'T00:00:00')
    return Math.max(1, Math.round((target.getTime() - today.getTime()) / 86_400_000))
  }, [mode, customDate])

  const { data, isLoading } = useCashFlowForecast(days)

  return (
    <div className="rounded-xl p-5" style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Previsão de Fluxo de Caixa</p>
          <p className="text-xs mt-0.5" style={{ color: '#444' }}>
            Baseada em contratos recorrentes ativos e custos fixos — não inclui receita/despesa variável futura
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg flex-wrap" style={{ background: '#1a1a1a' }}>
          {PRESETS.map((p) => (
            <button key={p.mode} onClick={() => setMode(p.mode)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
              style={{ background: mode === p.mode ? 'var(--tenant-primary)' : 'transparent', color: mode === p.mode ? '#000' : '#888' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'custom' && (
        <div className="flex items-center gap-2 mb-4">
          <DatePicker
            value={customDate}
            onChange={(v) => v && setCustomDate(v)}
            minDate={new Date().toISOString().slice(0, 10)}
            placeholder="Projetar até"
            clearable={false}
            className="w-40"
          />
          <span className="text-xs" style={{ color: '#555' }}>({days} dias a partir de hoje)</span>
        </div>
      )}

      {isLoading || !data ? (
        <div className="h-48 rounded-xl animate-pulse" style={{ background: '#1a1a1a' }} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat icon={TrendingUp} color="#00e676" label="Receita confirmada" value={formatCurrency(data.confirmedIncome)} />
            <MiniStat icon={TrendingDown} color="#ff4444" label="Custo fixo projetado" value={formatCurrency(data.confirmedExpenses)} />
            <MiniStat icon={Wallet} color={data.projectedBalance >= 0 ? '#40a0ff' : '#fbbf24'}
              label="Saldo projetado" value={formatCurrency(data.projectedBalance)} />
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.timeline} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#40a0ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#40a0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#444' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: '#444' }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cumulative" stroke="#40a0ff" strokeWidth={2}
                fill="url(#cashFlowGradient)" dot={{ r: 2, fill: '#40a0ff', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
