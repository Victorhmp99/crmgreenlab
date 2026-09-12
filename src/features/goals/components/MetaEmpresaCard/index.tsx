import { useState } from 'react'
import { Building2, Pencil, RefreshCw, Check, X, Trash2, Lock } from 'lucide-react'
import { ProgressBar } from '../ProgressBar'
import { Input } from '@/components/ui/Input'
import { usePermissions } from '@/hooks/usePermissions'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { ritmoDaMeta, situacaoDaMeta } from '../../ritmo'
import { formatCurrency } from '@/lib/utils'
import type { MetaEmpresa, SalvarMetaEmpresa, GoalWithProgress, GoalProgress } from '@/services/goals'

/**
 * Meta da empresa no período corrente.
 *
 * O gestor pode definir um número PRÓPRIO pra empresa; quando não define, a
 * referência é a soma das metas individuais do mesmo período. Quando define
 * os dois existem, o dele manda e a soma aparece ao lado — decisão registrada
 * no plano ("o dele, com a soma como referência").
 */
export function MetaEmpresaCard({ meta, individuais, inicio, fim }: {
  meta:        MetaEmpresa | null
  /** Metas individuais do mesmo período: viram a referência quando a empresa
      não definiu número próprio — alvo E realizado somados. */
  individuais: GoalWithProgress[]
  /** Período corrente (mês), usado ao criar a meta quando ainda não existe. */
  inicio: string
  fim:    string
}) {
  const { isManager } = usePermissions()
  const { salvarEmpresa, removerEmpresa } = useGoalMutations()
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState<SalvarMetaEmpresa>(() => ({
    period: 'monthly', start_date: inicio, end_date: fim,
    leads_target: meta?.leads_target ?? null, calls_target: meta?.calls_target ?? null,
    meetings_target: meta?.meetings_target ?? null,
    deals_target: meta?.deals_target ?? null, revenue_target: meta?.revenue_target ?? null,
    renovar: meta?.renovar ?? true,
  }))

  const encerrada = !!meta?.encerrada_em
  const ritmo     = ritmoDaMeta(meta?.start_date ?? inicio, meta?.end_date ?? fim)

  // Sem meta própria, a empresa é a soma do que foi definido pra cada pessoa —
  // no alvo e no realizado. Com meta própria, o realizado é da empresa inteira
  // (vem do banco, inclui lead sem dono) e a soma fica só como referência.
  const somaIndividuais = individuais.reduce((acc, g) => ({
    leads:    acc.leads    + (g.leads_target    ?? 0),
    calls:    acc.calls    + (g.calls_target    ?? 0),
    meetings: acc.meetings + (g.meetings_target ?? 0),
    deals:    acc.deals    + (g.deals_target    ?? 0),
    revenue:  acc.revenue  + Number(g.revenue_target ?? 0),
  }), { leads: 0, calls: 0, meetings: 0, deals: 0, revenue: 0 })
  const realizadoIndividuais: GoalProgress = individuais.reduce((acc, g) => ({
    ...acc,
    leadsActual:    acc.leadsActual    + g.progress.leadsActual,
    callsActual:    acc.callsActual    + g.progress.callsActual,
    meetingsActual: acc.meetingsActual + g.progress.meetingsActual,
    dealsActual:    acc.dealsActual    + g.progress.dealsActual,
    revenueActual:  acc.revenueActual  + g.progress.revenueActual,
  }), { leadsActual: 0, callsActual: 0, meetingsActual: 0, dealsActual: 0, revenueActual: 0,
        leadsPercent: 0, callsPercent: 0, meetingsPercent: 0, dealsPercent: 0, revenuePercent: 0, overallPercent: 0 })

  const p         = meta ? meta.progress : (individuais.length ? realizadoIndividuais : null)
  const soma      = meta?.somaIndividual ?? somaIndividuais

  // alvo efetivo: o próprio, ou a soma das individuais quando não definiu
  const alvo = {
    leads:    meta?.leads_target    ?? (soma?.leads    || null),
    calls:    meta?.calls_target    ?? (soma?.calls    || null),
    meetings: meta?.meetings_target ?? (soma?.meetings || null),
    deals:    meta?.deals_target    ?? (soma?.deals    || null),
    revenue:  meta?.revenue_target  ?? (soma?.revenue  || null),
  }
  const temAlvo = !!(alvo.leads || alvo.calls || alvo.meetings || alvo.deals || alvo.revenue)
  const pct = (a: number, t: number | null) => t ? Math.min(100, Math.round((a / t) * 100)) : 0

  // Percentual geral contra o alvo EFETIVO (próprio ou soma): média dos itens
  // definidos, igual ao card individual e à rotina do banco.
  const itens = p ? [
    alvo.leads    ? pct(p.leadsActual,    alvo.leads)    : null,
    alvo.calls    ? pct(p.callsActual,    alvo.calls)    : null,
    alvo.meetings ? pct(p.meetingsActual, alvo.meetings) : null,
    alvo.deals    ? pct(p.dealsActual,    alvo.deals)    : null,
    alvo.revenue ? pct(p.revenueActual, alvo.revenue) : null,
  ].filter((x): x is number => x != null) : []
  const geral    = itens.length ? Math.round(itens.reduce((a, b) => a + b, 0) / itens.length) : 0
  const situacao = situacaoDaMeta(geral, ritmo.esperadoPct)

  async function salvar() {
    setErro(null)
    try {
      await salvarEmpresa.mutateAsync({ id: meta?.id, data: form })
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: '#101a14', border: '1px solid rgba(0,230,118,0.2)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,230,118,0.12)' }}>
            <Building2 size={18} style={{ color: '#00e676' }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: '#e8e8e8' }}>Meta da empresa</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: '#666' }}>
                {new Date((meta?.start_date ?? inicio) + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              {encerrada && (
                <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                  style={{ background: '#1e1e1e', color: '#888' }}><Lock size={9} /> encerrada</span>
              )}
              {meta?.renovar && (
                <span className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                  style={{ background: 'rgba(64,160,255,0.12)', color: '#40a0ff' }}><RefreshCw size={9} /> renova</span>
              )}
              {!meta && (
                <span className="text-[10px] rounded-full px-1.5 py-0.5" style={{ background: '#1e1e1e', color: '#888' }}>
                  soma das individuais
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {p && temAlvo && (
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold tabular-nums"
                style={{ color: geral >= 100 ? '#00e676' : '#e8e8e8' }}>
                {geral}%
              </span>
              <span className="text-[10px]" style={{ color: '#444' }}>geral</span>
            </div>
          )}
          {isManager && !encerrada && !editando && (
            <button onClick={() => setEditando(true)} title="Definir meta da empresa"
              className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ color: '#555' }}>
              <Pencil size={13} />
            </button>
          )}
          {isManager && meta && !encerrada && !editando && (
            <button onClick={() => removerEmpresa.mutate(meta.id)} title="Remover meta da empresa (volta a usar a soma)"
              className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ color: '#555' }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {editando ? (
        <div className="flex flex-col gap-3 rounded-xl p-3" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
          <p className="text-[11px]" style={{ color: '#666' }}>
            Em branco = usa a soma das metas individuais daquele item.
            {soma && ` Soma hoje: ${soma.leads} leads · ${soma.calls} contatos · ${soma.meetings} agendamentos · ${soma.deals} vendas · ${formatCurrency(soma.revenue)}.`}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Input label="Leads" type="number" min={0} placeholder="—" value={form.leads_target ?? ''}
              onChange={(e) => setForm({ ...form, leads_target: num(e.target.value) })} />
            <Input label="Contatos" type="number" min={0} placeholder="—" value={form.calls_target ?? ''}
              onChange={(e) => setForm({ ...form, calls_target: num(e.target.value) })} />
            <Input label="Agendamentos" type="number" min={0} placeholder="—" value={form.meetings_target ?? ''}
              onChange={(e) => setForm({ ...form, meetings_target: num(e.target.value) })} />
            <Input label="Vendas" type="number" min={0} placeholder="—" value={form.deals_target ?? ''}
              onChange={(e) => setForm({ ...form, deals_target: num(e.target.value) })} />
            <Input label="Faturamento (R$)" type="number" min={0} step="0.01" placeholder="—" value={form.revenue_target ?? ''}
              onChange={(e) => setForm({ ...form, revenue_target: num(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#aaa' }}>
            <input type="checkbox" checked={!!form.renovar}
              onChange={(e) => setForm({ ...form, renovar: e.target.checked })} />
            Renovar automaticamente todo mês com os mesmos números
          </label>
          {erro && <p className="text-xs" style={{ color: '#ff4444' }}>{erro}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditando(false); setErro(null) }}
              className="flex items-center gap-1 text-xs rounded-lg px-3 py-1.5" style={{ color: '#888', border: '1px solid #2a2a2a' }}>
              <X size={12} /> Cancelar
            </button>
            <button onClick={salvar} disabled={salvarEmpresa.isPending}
              className="flex items-center gap-1 text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50"
              style={{ background: 'var(--tenant-primary)', color: '#0d0d0d' }}>
              <Check size={12} /> Salvar
            </button>
          </div>
        </div>
      ) : !temAlvo ? (
        <p className="text-xs text-center py-2" style={{ color: '#444' }}>
          Nenhuma meta definida — nem da empresa, nem individual neste período.
        </p>
      ) : (
        <>
          {p && !encerrada && (
            <div className="flex items-center justify-between text-[11px] rounded-lg px-2.5 py-1.5"
              style={{
                background: situacao === 'atras' ? 'rgba(255,68,68,0.08)' : situacao === 'frente' ? 'rgba(0,230,118,0.08)' : '#161616',
                color:      situacao === 'atras' ? '#ff6666' : situacao === 'frente' ? '#00e676' : '#888',
              }}>
              <span>
                {situacao === 'atras' ? 'Atrás do ritmo' : situacao === 'frente' ? 'Na frente do ritmo' : 'No ritmo'}
                {' · '}esperado hoje {ritmo.esperadoPct}%
              </span>
              <span style={{ color: '#666' }}>{ritmo.diasRestantes === 0 ? 'último dia' : `faltam ${ritmo.diasRestantes} dias`}</span>
            </div>
          )}
          {p && (
            <div className="flex flex-col gap-3 pt-1" style={{ borderTop: '1px solid #1a2a1f' }}>
              {alvo.leads   && <ProgressBar label="Leads captados" actual={p.leadsActual}   target={alvo.leads}   percent={pct(p.leadsActual, alvo.leads)}     color="#40a0ff" />}
              {alvo.calls    && <ProgressBar label="Contatos"     actual={p.callsActual}    target={alvo.calls}    percent={pct(p.callsActual, alvo.calls)}       color="#fbbf24" />}
              {alvo.meetings && <ProgressBar label="Agendamentos" actual={p.meetingsActual} target={alvo.meetings} percent={pct(p.meetingsActual, alvo.meetings)} color="#f472b6" />}
              {alvo.deals   && <ProgressBar label="Vendas"         actual={p.dealsActual}   target={alvo.deals}   percent={pct(p.dealsActual, alvo.deals)}     color="#00e676" />}
              {alvo.revenue && <ProgressBar label="Faturamento"    actual={p.revenueActual} target={alvo.revenue} percent={pct(p.revenueActual, alvo.revenue)} color="#a78bfa" moeda />}
            </div>
          )}
          {meta && soma && (soma.leads || soma.calls || soma.meetings || soma.deals || soma.revenue) ? (
            <p className="text-[10px]" style={{ color: '#555' }}>
              Soma das individuais: {soma.leads} leads · {soma.calls} contatos · {soma.meetings} agendamentos · {soma.deals} vendas · {formatCurrency(soma.revenue)}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
