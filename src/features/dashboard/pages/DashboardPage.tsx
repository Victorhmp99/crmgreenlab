import { useState } from 'react'
import { Users, TrendingUp, DollarSign, Wallet, XCircle, MessageCircle, Calendar, RefreshCw, Briefcase, Handshake, Target, Eye, EyeOff, X } from 'lucide-react'
import { useDashboardMetrics } from '../hooks/useDashboardMetrics'
import { useDashboardGoals } from '@/features/goals/hooks/useGoals'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'
import { Spinner } from '@/components/ui/Spinner'
import { DatePicker } from '@/components/ui/DatePicker'
import { formatDate } from '@/lib/utils'
import type { GoalWithProgress } from '@/services/goals'

// ── Card de meta reutilizável ─────────────────────────────────────────────────
function GoalRow({ goal, hidden, showAssignee = false }: {
  goal:         GoalWithProgress
  hidden:       boolean
  showAssignee?: boolean
}) {
  const pct = goal.progress.overallPercent
  const color = pct >= 100 ? '#00e676' : pct >= 60 ? '#fbbf24' : 'var(--tenant-primary)'
  return (
    <div className="rounded-lg p-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: '#555' }}>
            {goal.period === 'daily' ? 'Diária' :
             goal.period === 'weekly' ? 'Semanal' :
             goal.period === 'monthly' ? 'Mensal' : 'Trimestral'}
          </span>
          {showAssignee && goal.userFullName && (
            <span className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
              {goal.userFullName}
            </span>
          )}
          {showAssignee && !goal.userFullName && goal.userEmail && (
            <span className="text-[10px] rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
              {goal.userEmail.split('@')[0]}
            </span>
          )}
        </div>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {hidden ? '●●%' : `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full mb-2" style={{ background: '#1a1a1a' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: '#666' }}>
        {goal.leads_target != null && (
          <span>Leads: <strong style={{ color: '#aaa' }}>{hidden ? '●/●' : `${goal.progress.leadsActual}/${goal.leads_target}`}</strong></span>
        )}
        {goal.calls_target != null && (
          <span>Disparos: <strong style={{ color: '#aaa' }}>{hidden ? '●/●' : `${goal.progress.callsActual}/${goal.calls_target}`}</strong></span>
        )}
        {goal.deals_target != null && (
          <span>Fechamentos: <strong style={{ color: '#aaa' }}>{hidden ? '●/●' : `${goal.progress.dealsActual}/${goal.deals_target}`}</strong></span>
        )}
      </div>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value)
}

function formatTodayLabel(): string {
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
  const d = new Date()
  return `${d.getDate()} de ${months[d.getMonth()]}`
}

// ── Card pequeno KPI ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sublabel, icon: Icon, color }: {
  label: string; value: string | number; sublabel?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1 transition-colors"
      style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide" style={{ color: '#555' }}>{label}</p>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}22` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#e8e8e8' }}>{value}</p>
      {sublabel && <p className="text-xs" style={{ color: '#555' }}>{sublabel}</p>}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { user, tenant } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const { data, isLoading, refetch, dataUpdatedAt } = useDashboardMetrics(dateFrom || undefined, dateTo || undefined)
  const { data: dashGoals } = useDashboardGoals()
  const { hidden, toggle, mask, maskCurrency } = usePrivacyMode()
  const { isManager, isSuperAdmin } = usePermissions()

  // Vendedor vê a carteira DELE; gestor vê a da empresa. Quem decide o recorte
  // é o banco (`get_pipeline_financial_metrics` devolve `escopo`), não esta
  // tela — esconder card nunca protegeu nada, o número chegava no navegador
  // do mesmo jeito. Aqui só mudam o título e o card de Receita, que é caixa
  // da empresa e não pertence a lead nenhum.
  const canSeeFinancial = isManager || isSuperAdmin

  // Filtra metas ativas (período atual)
  const today      = new Date().toISOString().slice(0, 10)
  const activeOwn  = (dashGoals?.mine ?? []).filter((g) => g.start_date <= today && today <= g.end_date)
  const activeTeam = (dashGoals?.team ?? []).filter((g) => g.start_date <= today && today <= g.end_date)

  const name = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ') ?? 'usuário'

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold capitalize" style={{ color: '#e8e8e8' }}>
            {greeting()},{' '}
            <span style={{ color: 'var(--tenant-primary)' }}>{name}</span> 👋
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#555' }}>
            {tenant?.name ?? 'Green Hub'}
          </p>
        </div>
        {/* Quebra linha no celular: com `shrink-0` e sem wrap, o ultimo botao
            saia da tela e ficava inalcancavel, porque a barra nao rola. */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap sm:shrink-0">
          <button
            onClick={toggle}
            title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              color: hidden ? 'var(--tenant-primary)' : '#555',
              background: hidden ? 'rgba(0,230,118,0.08)' : 'transparent',
              border: '1px solid ' + (hidden ? 'rgba(0,230,118,0.3)' : '#2a2a2a'),
            }}
            onMouseEnter={(e) => {
              if (!hidden) (e.currentTarget as HTMLButtonElement).style.color = '#aaa'
            }}
            onMouseLeave={(e) => {
              if (!hidden) (e.currentTarget as HTMLButtonElement).style.color = '#555'
            }}
          >
            {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
            style={{ color: '#555' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            {lastUpdated ? `Atualizado às ${lastUpdated}` : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* ── KPIs principais (3 grandes em destaque) ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.08), transparent)', border: '1px solid rgba(0,230,118,0.2)' }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,230,118,0.15)' }}>
            <Users size={20} style={{ color: '#00e676' }} />
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>
              {isLoading ? '—' : mask((data?.financial.active_count ?? 0) + (data?.financial.in_progress_count ?? 0))}
            </p>
            <p className="text-sm" style={{ color: '#888' }}>Leads Ativos</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>
              Vivos (exclui fechados/perdidos)
            </p>
          </div>
        </div>

        <div className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(64,160,255,0.08), transparent)', border: '1px solid rgba(64,160,255,0.2)' }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(64,160,255,0.15)' }}>
            <Handshake size={20} style={{ color: '#40a0ff' }} />
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>
              {isLoading ? '—' : mask(data?.financial.in_progress_count ?? 0)}
            </p>
            <p className="text-sm" style={{ color: '#888' }}>Em Negociação</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>
              No pipeline
            </p>
          </div>
        </div>

        <div className="rounded-xl p-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.08), transparent)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(167,139,250,0.15)' }}>
            <TrendingUp size={20} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums" style={{ color: '#e8e8e8' }}>
              {isLoading ? '—' : mask(data?.financial.won_count ?? 0)}
            </p>
            <p className="text-sm" style={{ color: '#888' }}>Fechamentos</p>
            <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>
              Convertidos
            </p>
          </div>
        </div>
      </div>

      {/* ── Carteira — da empresa pro gestor, minha pro vendedor ─────────── */}
      <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#666' }}>
                {canSeeFinancial ? 'Carteira' : 'Meus números'}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: '#444' }}>
                Período: {dateFrom || dateTo
                  ? `${dateFrom ? formatDate(dateFrom) : 'início'} até ${dateTo ? formatDate(dateTo) : 'hoje'}`
                  : 'todo o histórico'}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data início" className="w-36" />
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data fim" className="w-36" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors shrink-0"
                  style={{ color: '#555' }} title="Limpar período (mostra tudo)">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              label="Previsão (Pipeline)"
              value={isLoading ? '—' : maskCurrency(formatCurrency(Number(data?.financial.forecast ?? 0)))}
              sublabel={`${hidden ? '●' : (data?.financial.in_progress_count ?? 0)} oportunidades`}
              icon={Briefcase}
              color="#40a0ff"
            />
            <KpiCard
              label="Faturamento"
              value={isLoading ? '—' : maskCurrency(formatCurrency(Number(data?.financial.faturamento ?? 0)))}
              sublabel={`${hidden ? '●' : (data?.financial.won_count ?? 0)} fechamentos vendidos`}
              icon={DollarSign}
              color="#00e676"
            />
            {/* Receita é o caixa da empresa (lançamentos e contratos), não a
                soma de leads de alguém — some pra quem não é gestor. */}
            {canSeeFinancial && (
              <KpiCard
                label="Receita"
                value={isLoading ? '—' : maskCurrency(formatCurrency(Number(data?.financial.receita ?? 0)))}
                sublabel="Dinheiro de fato recebido"
                icon={Wallet}
                color="#40a0ff"
              />
            )}
            <KpiCard
              label="Perdidos"
              value={isLoading ? '—' : mask(data?.financial.lost_count ?? 0)}
              sublabel="leads perdidos"
              icon={XCircle}
              color="#ff4444"
            />
            <KpiCard
              label="Ticket Médio"
              value={isLoading ? '—' : maskCurrency(formatCurrency(Number(data?.financial.avg_ticket ?? 0)))}
              sublabel="Por fechamento"
              icon={MessageCircle}
              color="#a78bfa"
            />
          </div>
      </div>

      {/* ── Grid principal: Agenda + Tarefas + Conversão ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Agenda ───────────────────────────────────────────────────── */}
        <div className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: 'var(--tenant-primary)' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Agenda</h3>
            </div>
            <span className="text-xs" style={{ color: '#555' }}>{formatTodayLabel()}</span>
          </div>

          <div className="rounded-lg p-6 text-center"
            style={{ background: '#0d0d0d', border: '1px dashed #1e1e1e' }}>
            <Calendar size={24} className="mx-auto mb-2" style={{ color: '#333' }} />
            <p className="text-xs" style={{ color: '#555' }}>
              Nenhum compromisso para hoje.
            </p>
          </div>
        </div>

        {/* ── Metas ────────────────────────────────────────────────────── */}
        <div className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2">
            <Target size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Metas</h3>
          </div>

          {/* Minhas metas (atribuídas a mim) */}
          {activeOwn.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#555' }}>Minhas metas</p>
              {activeOwn.slice(0, 3).map((goal) => (
                <GoalRow key={goal.id} goal={goal} hidden={hidden} />
              ))}
              {activeOwn.length > 3 && (
                <p className="text-[10px] text-center" style={{ color: '#444' }}>
                  +{activeOwn.length - 3} outras em <a href="#/goals" style={{ color: 'var(--tenant-primary)' }}>Metas</a>
                </p>
              )}
            </div>
          )}

          {/* Metas que criei para a equipe */}
          {activeTeam.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#555' }}>Metas da equipe</p>
              {activeTeam.slice(0, 4).map((goal) => (
                <GoalRow key={goal.id} goal={goal} hidden={hidden} showAssignee />
              ))}
              {activeTeam.length > 4 && (
                <p className="text-[10px] text-center" style={{ color: '#444' }}>
                  +{activeTeam.length - 4} outras em <a href="#/goals" style={{ color: 'var(--tenant-primary)' }}>Metas</a>
                </p>
              )}
            </div>
          )}

          {/* Nenhuma meta */}
          {activeOwn.length === 0 && activeTeam.length === 0 && (
            <div className="rounded-lg p-4 text-center"
              style={{ background: '#0d0d0d', border: '1px dashed #1e1e1e' }}>
              <Target size={20} className="mx-auto mb-2" style={{ color: '#333' }} />
              <p className="text-xs" style={{ color: '#555' }}>Nenhuma meta ativa no período.</p>
            </div>
          )}
        </div>

        {/* ── Conversão ────────────────────────────────────────────────── */}
        <div className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: '#141414', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={15} style={{ color: 'var(--tenant-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#e8e8e8' }}>Conversão</h3>
          </div>

          {/* Taxa grande — usa conversion_rate financeiro (won/(won+lost)) */}
          <div className="flex flex-col items-center justify-center py-3">
            <p className="text-5xl font-bold tabular-nums" style={{ color: 'var(--tenant-primary)' }}>
              {isLoading ? '—' : `${data?.financial.conversion_rate ?? 0}%`}
            </p>
            <p className="text-[11px] uppercase tracking-widest mt-1" style={{ color: '#555' }}>Taxa</p>
          </div>

          {/* Quebra ganhos/perdidos com valores */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}>
              <p className="text-xl font-bold tabular-nums" style={{ color: '#00e676' }}>
                {mask(data?.financial.won_count ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: '#666' }}>Ganhos</p>
            </div>
            <div className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>
              <p className="text-xl font-bold tabular-nums" style={{ color: '#ff4444' }}>
                {mask(data?.financial.lost_count ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: '#666' }}>Perdidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading global se ainda não tem dados */}
      {isLoading && !data && (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      )}
    </div>
  )
}
