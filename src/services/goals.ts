import { supabase } from '@/lib/supabase'
import type { Goal, GoalPeriod } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GoalProgress {
  leadsActual:    number
  callsActual:    number
  dealsActual:    number
  revenueActual:  number
  leadsPercent:   number
  callsPercent:   number
  dealsPercent:   number
  revenuePercent: number
  overallPercent: number  // média dos itens com meta definida
}

export interface GoalWithProgress extends Goal {
  userEmail:    string | null
  userFullName: string | null
  progress:     GoalProgress
}

export interface CreateGoalData {
  user_id:        string
  period:         GoalPeriod
  start_date:     string
  end_date:       string
  leads_target?:   number | null
  calls_target?:   number | null
  deals_target?:   number | null
  revenue_target?: number | null
  renovar?:        boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(actual: number, target: number | null): number {
  if (!target) return 0
  return Math.min(Math.round((actual / target) * 100), 100)
}

type Realizado = Pick<GoalProgress, 'leadsActual' | 'callsActual' | 'dealsActual' | 'revenueActual'>

function overall(g: Goal, r: Realizado): number {
  const items: number[] = []
  if (g.leads_target)   items.push(pct(r.leadsActual,   g.leads_target))
  if (g.calls_target)   items.push(pct(r.callsActual,   g.calls_target))
  if (g.deals_target)   items.push(pct(r.dealsActual,   g.deals_target))
  if (g.revenue_target) items.push(pct(r.revenueActual, Number(g.revenue_target)))
  return items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length) : 0
}

function montarProgresso(g: Goal, r: Realizado): GoalProgress {
  return {
    ...r,
    leadsPercent:   pct(r.leadsActual,   g.leads_target),
    callsPercent:   pct(r.callsActual,   g.calls_target),
    dealsPercent:   pct(r.dealsActual,   g.deals_target),
    revenuePercent: pct(r.revenueActual, g.revenue_target != null ? Number(g.revenue_target) : null),
    overallPercent: overall(g, r),
  }
}

// ── Listar metas com progresso ────────────────────────────────────────────────

export async function fetchGoalsWithProgress(
  tenantId: string,
  onlyActive = false,
): Promise<GoalWithProgress[]> {
  // Usa RPC SECURITY DEFINER que bypassa RLS e já traz email/nome
  const { data, error } = await supabase.rpc('get_tenant_goals', {
    p_tenant_id:   tenantId,
    p_only_active: onlyActive,
  })

  if (error) throw error

  // Colunas da migration 080 (renovar, encerrada_em, resultado_final) nao
  // vem da RPC antiga; a tabela e lida direto — o RLS de `goals` ja limita ao
  // que a pessoa pode ver.
  const { data: extras } = await supabase
    .from('goals').select('id, renovar, encerrada_em, resultado_final').eq('tenant_id', tenantId)
  const extraPorId = new Map((extras ?? []).map((e) => [e.id as string, e]))

  const goals = ((data ?? []) as Array<{
    id: string; tenant_id: string; user_id: string;
    period: string; start_date: string; end_date: string;
    leads_target: number | null; calls_target: number | null; deals_target: number | null;
    revenue_target: number | null; created_by: string | null; created_at: string;
    user_email: string | null; user_full_name: string | null;
  }>).map((row) => ({
    id:             row.id,
    tenant_id:      row.tenant_id,
    user_id:        row.user_id,
    period:         row.period as GoalPeriod,
    start_date:     row.start_date,
    end_date:       row.end_date,
    leads_target:   row.leads_target,
    calls_target:   row.calls_target,
    deals_target:   row.deals_target,
    revenue_target: row.revenue_target,
    created_by:     row.created_by,
    created_at:     row.created_at,
    userEmail:      row.user_email,
    userFullName:   row.user_full_name,
    renovar:         (extraPorId.get(row.id)?.renovar as boolean | undefined) ?? false,
    encerrada_em:    (extraPorId.get(row.id)?.encerrada_em as string | null | undefined) ?? null,
    resultado_final: (extraPorId.get(row.id)?.resultado_final as Goal['resultado_final']) ?? null,
  } as Omit<GoalWithProgress, 'progress'>))

  // O realizado vem do banco, numa chamada só e com a MESMA régua do Dashboard
  // (migration 079). Antes eram três consultas por meta, no navegador, com uma
  // regra própria de venda — e o faturamento nunca era calculado.
  const { data: prog, error: progErr } = await supabase.rpc('progresso_das_metas', {
    p_tenant_id:   tenantId,
    p_only_active: onlyActive,
  })
  if (progErr) throw progErr

  const porMeta = new Map<string, Realizado>()
  for (const r of (prog ?? []) as Array<{
    goal_id: string; leads_actual: number; calls_actual: number; deals_actual: number; revenue_actual: number | string
  }>) {
    porMeta.set(r.goal_id, {
      leadsActual:   r.leads_actual,
      callsActual:   r.calls_actual,
      dealsActual:   r.deals_actual,
      revenueActual: Number(r.revenue_actual ?? 0),
    })
  }

  const vazio: Realizado = { leadsActual: 0, callsActual: 0, dealsActual: 0, revenueActual: 0 }
  return goals.map((g) => ({
    ...g,
    progress: montarProgresso(g as Goal, porMeta.get(g.id) ?? vazio),
  } as GoalWithProgress))
}

// ── Metas atribuídas ao usuário ──────────────────────────────────────────────

export async function fetchUserGoals(tenantId: string, userId: string): Promise<GoalWithProgress[]> {
  const all = await fetchGoalsWithProgress(tenantId, false)
  return all.filter((g) => g.user_id === userId)
}

// ── Metas para o dashboard: próprias + criadas para a equipe ─────────────────

export interface DashboardGoals {
  mine:  GoalWithProgress[]   // atribuídas a mim
  team:  GoalWithProgress[]   // eu criei para outros
}

export async function fetchDashboardGoals(
  tenantId: string,
  userId: string,
): Promise<DashboardGoals> {
  const all = await fetchGoalsWithProgress(tenantId, false)

  const mine = all.filter((g) => g.user_id === userId)
  const team = all.filter((g) => g.created_by === userId && g.user_id !== userId)

  return { mine, team }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createGoal(tenantId: string, createdBy: string, data: CreateGoalData): Promise<Goal> {
  const { data: created, error } = await supabase
    .from('goals')
    .insert({
      tenant_id:     tenantId,
      created_by:    createdBy,
      user_id:       data.user_id,
      period:        data.period,
      start_date:    data.start_date,
      end_date:      data.end_date,
      leads_target:   data.leads_target ?? null,
      calls_target:   data.calls_target ?? null,
      deals_target:   data.deals_target ?? null,
      revenue_target: data.revenue_target ?? null,
      renovar:        data.renovar ?? false,
    })
    .select()
    .single()

  // 23505 = a trava de "uma meta por pessoa por período" (migration 081). A
  // mensagem crua do Postgres não diz o que fazer.
  if (error && (error as { code?: string }).code === '23505') {
    throw new Error('Já existe uma meta para esta pessoa neste período. Edite a que já existe.')
  }

  if (error) throw error
  return created as Goal
}

export async function updateGoal(id: string, data: Partial<CreateGoalData>): Promise<void> {
  const { error } = await supabase.from('goals').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

// ── Ranking da equipe no período ─────────────────────────────────────────────

export interface LeaderboardEntry {
  userId:      string
  email:       string
  fullName:    string | null
  leads:       number
  calls:       number
  deals:       number
  /** Só vem pra gestor. Vendedor recebe null e a tela não mostra a coluna. */
  revenue:     number | null
  totalScore:  number   // leads + contatos + vendas*3, calculado no banco
}

export async function fetchLeaderboard(
  tenantId: string,
  startDate: string,
  endDate:   string,
): Promise<LeaderboardEntry[]> {
  // Antes chamava `get_tenant_users` (restrita a gestor): pra vendedor a aba
  // vinha vazia sem erro nenhum. O ranking agora é uma função do banco que
  // todo membro executa — com os reais só pra gestor (migration 079).
  const { data, error } = await supabase.rpc('ranking_do_periodo', {
    p_tenant_id: tenantId,
    p_from:      startDate.slice(0, 10),
    p_to:        endDate.slice(0, 10),
  })
  if (error) throw error

  return ((data ?? []) as Array<{
    user_id: string; email: string; full_name: string | null;
    leads: number; contatos: number; vendas: number;
    faturamento: number | string | null; pontos: number
  }>).map((r) => ({
    userId:     r.user_id,
    email:      r.email,
    fullName:   r.full_name,
    leads:      r.leads,
    calls:      r.contatos,
    deals:      r.vendas,
    revenue:    r.faturamento == null ? null : Number(r.faturamento),
    totalScore: r.pontos,
  }))
}

// ── Auditoria: do que é feito o número ───────────────────────────────────────

export interface DetalheMeta {
  leads:    Array<{ id: string; nome: string; em: string }>
  contatos: Array<{ lead_id: string; nome: string; tipo: string; origem: 'sistema' | 'manual'; em: string; vezes: number }>
  vendas:   Array<{ id: string; nome: string; valor: number | null; em: string }>
}

export async function fetchDetalheMeta(goalId: string): Promise<DetalheMeta> {
  const { data, error } = await supabase.rpc('detalhe_da_meta', { p_goal_id: goalId })
  if (error) throw error
  return data as DetalheMeta
}

// ── Meta da empresa ──────────────────────────────────────────────────────────

export interface MetaEmpresa {
  id:              string
  period:          GoalPeriod
  start_date:      string
  end_date:        string
  leads_target:    number | null
  calls_target:    number | null
  deals_target:    number | null
  revenue_target:  number | null
  renovar:         boolean
  encerrada_em:    string | null
  progress:        GoalProgress
  /** Soma dos alvos individuais do mesmo período — referência ao lado do número próprio. */
  somaIndividual:  { leads: number; calls: number; deals: number; revenue: number }
}

export async function fetchMetasEmpresa(tenantId: string, onlyActive = false): Promise<MetaEmpresa[]> {
  const { data, error } = await supabase.rpc('metas_da_empresa', {
    p_tenant_id: tenantId, p_only_active: onlyActive,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const alvo = {
      leads_target:   r.leads_target as number | null,
      calls_target:   r.calls_target as number | null,
      deals_target:   r.deals_target as number | null,
      revenue_target: r.revenue_target == null ? null : Number(r.revenue_target),
    }
    const realizado: Realizado = {
      leadsActual:   Number(r.leads_actual ?? 0),
      callsActual:   Number(r.calls_actual ?? 0),
      dealsActual:   Number(r.deals_actual ?? 0),
      revenueActual: Number(r.revenue_actual ?? 0),
    }
    return {
      id:           r.id as string,
      period:       r.period as GoalPeriod,
      start_date:   r.start_date as string,
      end_date:     r.end_date as string,
      ...alvo,
      renovar:      !!r.renovar,
      encerrada_em: (r.encerrada_em as string | null) ?? null,
      progress:     montarProgresso(alvo as Goal, realizado),
      somaIndividual: {
        leads:   Number(r.soma_leads_target ?? 0),
        calls:   Number(r.soma_calls_target ?? 0),
        deals:   Number(r.soma_deals_target ?? 0),
        revenue: Number(r.soma_revenue_target ?? 0),
      },
    }
  })
}

export interface SalvarMetaEmpresa {
  period:          GoalPeriod
  start_date:      string
  end_date:        string
  leads_target?:   number | null
  calls_target?:   number | null
  deals_target?:   number | null
  revenue_target?: number | null
  renovar?:        boolean
}

export async function salvarMetaEmpresa(tenantId: string, createdBy: string, data: SalvarMetaEmpresa, id?: string): Promise<void> {
  const linha = { tenant_id: tenantId, created_by: createdBy, ...data }
  const q = id
    ? supabase.from('metas_empresa').update(linha).eq('id', id)
    : supabase.from('metas_empresa').insert(linha)
  const { error } = await q
  if (error) throw error
}

export async function excluirMetaEmpresa(id: string): Promise<void> {
  const { error } = await supabase.from('metas_empresa').delete().eq('id', id)
  if (error) throw error
}
