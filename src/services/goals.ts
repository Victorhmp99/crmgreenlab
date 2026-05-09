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

    // Disparos feitos pelo usuário no período (exclui eventos de sistema)
    goal.calls_target
      ? supabase.from('lead_activities').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('user_id', goal.user_id)
          .not('type', 'in', '("stage_change","import")')
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
  let query = supabase
    .from('goals')
    .select(`*, profiles ( email, full_name )`)
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false })

  if (onlyActive) {
    query = query.gte('end_date', new Date().toISOString().slice(0, 10))
  }

  const { data, error } = await query
  if (error) throw error

  const goals = (data ?? []).map((row) => {
    const profile = (row.profiles as unknown as { email: string; full_name: string | null } | null)
    return {
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
      userEmail:      profile?.email ?? null,
      userFullName:   profile?.full_name ?? null,
    } as Omit<GoalWithProgress, 'progress'>
  })

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
  // Busca membros ativos
  const { data: members } = await supabase
    .from('user_memberships')
    .select('user_id, profiles ( email, full_name )')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (!members?.length) return []

  const entries = await Promise.all(
    members.map(async (m) => {
      const profile = (m.profiles as unknown as { email: string; full_name: string | null } | null)
      const userId  = m.user_id

      const [leadsRes, callsRes, dealsRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('assigned_to', userId)
          .gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),

        supabase.from('lead_activities').select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('user_id', userId)
          .not('type', 'in', '("stage_change","import")')
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
        email:      profile?.email    ?? '—',
        fullName:   profile?.full_name ?? null,
        leads,
        calls,
        deals,
        totalScore: leads + calls + (deals * 3),  // fechamentos valem 3x
      }
    }),
  )

  return entries.sort((a, b) => b.totalScore - a.totalScore)
}
