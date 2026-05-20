import { supabase } from '@/lib/supabase'
import type { Goal, GoalPeriod } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GoalProgress {
  leadsActual:    number
  callsActual:    number
  dealsActual:    number
  leadsPercent:   number
  callsPercent:   number
  dealsPercent:   number
  overallPercent: number  // média ponderada dos itens com meta definida
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
  leads_target?:  number | null
  calls_target?:  number | null
  deals_target?:  number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(actual: number, target: number | null): number {
  if (!target) return 0
  return Math.min(Math.round((actual / target) * 100), 100)
}

function overall(g: Goal, progress: Omit<GoalProgress, 'leadsPercent' | 'callsPercent' | 'dealsPercent' | 'overallPercent'>): number {
  const items: number[] = []
  if (g.leads_target) items.push(pct(progress.leadsActual, g.leads_target))
  if (g.calls_target) items.push(pct(progress.callsActual, g.calls_target))
  if (g.deals_target) items.push(pct(progress.dealsActual, g.deals_target))
  return items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length) : 0
}

// ── Buscar progresso real de uma meta ─────────────────────────────────────────

async function fetchProgress(tenantId: string, goal: Goal): Promise<GoalProgress> {
  const [leadsRes, callsRes, dealsRes] = await Promise.all([
    // Leads captados pelo usuário no período
    goal.leads_target
      ? supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('assigned_to', goal.user_id)
          .gte('created_at', goal.start_date)
          .lte('created_at', goal.end_date + 'T23:59:59')
      : Promise.resolve({ count: 0 }),

    // Disparos do usuário no período — inclui:
    //   call/whatsapp/email/meeting/note registrados na aba Disparos
    //   stage_change (movimentações de card na pipeline feitas pelo usuário)
    // Exclui apenas 'import' (entrada em massa, não conta como ação manual)
    goal.calls_target
      ? supabase.from('lead_activities').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('user_id', goal.user_id)
          .neq('type', 'import')
          .gte('created_at', goal.start_date)
          .lte('created_at', goal.end_date + 'T23:59:59')
      : Promise.resolve({ count: 0 }),

    // Leads convertidos pelo usuário no período
    goal.deals_target
      ? supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('assigned_to', goal.user_id)
          .eq('status', 'converted')
          .gte('updated_at', goal.start_date)
          .lte('updated_at', goal.end_date + 'T23:59:59')
      : Promise.resolve({ count: 0 }),
  ])

  const leadsActual = leadsRes.count ?? 0
  const callsActual = callsRes.count ?? 0
  const dealsActual = dealsRes.count ?? 0

  console.log('[Goals] progresso da meta:', {
    user_id: goal.user_id,
    period: `${goal.start_date} → ${goal.end_date}`,
    targets: { leads: goal.leads_target, calls: goal.calls_target, deals: goal.deals_target },
    actuals: { leads: leadsActual, calls: callsActual, deals: dealsActual },
  })

  return {
    leadsActual,
    callsActual,
    dealsActual,
    leadsPercent:   pct(leadsActual, goal.leads_target),
    callsPercent:   pct(callsActual, goal.calls_target),
    dealsPercent:   pct(dealsActual, goal.deals_target),
    overallPercent: overall(goal, { leadsActual, callsActual, dealsActual }),
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
  } as Omit<GoalWithProgress, 'progress'>))

  // Progresso em paralelo (lote de até 5 para não sobrecarregar)
  const results: GoalWithProgress[] = []
  const BATCH = 5
  for (let i = 0; i < goals.length; i += BATCH) {
    const batch = goals.slice(i, i + BATCH)
    const progresses = await Promise.all(
      batch.map((g) => fetchProgress(tenantId, g as Goal)),
    )
    batch.forEach((g, idx) => results.push({ ...g, progress: progresses[idx] } as GoalWithProgress))
  }

  return results
}

// ── Metas de um usuário específico ───────────────────────────────────────────

export async function fetchUserGoals(tenantId: string, userId: string): Promise<GoalWithProgress[]> {
  const all = await fetchGoalsWithProgress(tenantId, false)
  return all.filter((g) => g.user_id === userId)
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
      leads_target:  data.leads_target ?? null,
      calls_target:  data.calls_target ?? null,
      deals_target:  data.deals_target ?? null,
    })
    .select()
    .single()

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

// ── Leaderboard da equipe no período corrente ─────────────────────────────────

export interface LeaderboardEntry {
  userId:      string
  email:       string
  fullName:    string | null
  leads:       number
  calls:       number
  deals:       number
  totalScore:  number   // leads + calls + deals (ponderado)
}

export async function fetchLeaderboard(
  tenantId: string,
  startDate: string,
  endDate:   string,
): Promise<LeaderboardEntry[]> {
  // Busca usuários ativos via RPC (bypassa RLS e já traz email/nome)
  const { data: users, error } = await supabase.rpc('get_tenant_users', { p_tenant_id: tenantId })
  if (error) throw error

  // Leaderboard exibe só Gestores e Vendedores — Admins não recebem metas
  const activeUsers = ((users ?? []) as Array<{
    user_id: string; email: string | null; full_name: string | null;
    role: string; active: boolean; account_status: string;
  }>).filter((u) =>
    u.active
    && u.account_status === 'active'
    && (u.role === 'manager' || u.role === 'seller'),
  )

  if (!activeUsers.length) return []

  const entries = await Promise.all(
    activeUsers.map(async (u) => {
      const userId = u.user_id

      const [leadsRes, callsRes, dealsRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('assigned_to', userId)
          .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),

        supabase.from('lead_activities').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('user_id', userId)
          .neq('type', 'import')  // inclui stage_change (movimentação na pipeline)
          .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),

        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('assigned_to', userId)
          .eq('status', 'converted')
          .gte('updated_at', startDate).lte('updated_at', endDate + 'T23:59:59'),
      ])

      const leads = leadsRes.count ?? 0
      const calls = callsRes.count ?? 0
      const deals = dealsRes.count ?? 0

      return {
        userId,
        email:      u.email    ?? '—',
        fullName:   u.full_name ?? null,
        leads,
        calls,
        deals,
        totalScore: leads + calls + (deals * 3),  // fechamentos valem 3x
      }
    }),
  )

  return entries.sort((a, b) => b.totalScore - a.totalScore)
}
