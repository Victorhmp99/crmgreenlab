import { supabase } from '@/lib/supabase'
import type { Lead, LeadSource } from '@/types'

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface SourceCount { source: LeadSource; count: number }
export interface StageCount  { stageId: string; stageName: string; color: string; count: number }
export interface DayCount    { date: string; count: number }

export interface DashboardMetrics {
  totalLeads:           number
  totalLeadsPrev:       number   // mesmo período anterior (para delta)
  leadsInPipeline:      number
  activitiesToday:      number
  activitiesYesterday:  number
  conversionsThisMonth: number
  conversionsPrevMonth: number
  leadsBySource:        SourceCount[]
  leadsByStage:         StageCount[]
  leadsLast30Days:      DayCount[]
  recentLeads:          Lead[]
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): string {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c.toISOString()
}
function startOfMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}
function startOfPrevMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString()
}
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Preenche todos os dias de um intervalo, colocando 0 quando não há dados
function fillDayGaps(data: Array<{ date: string; count: number }>, days: number): DayCount[] {
  const map = new Map(data.map((d) => [d.date.slice(0, 10), d.count]))
  const result: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, count: map.get(key) ?? 0 })
  }
  return result
}

// ── Query principal ────────────────────────────────────────────────────────────

export async function fetchDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
  const now         = new Date()
  const todayStart  = startOfDay(now)
  const monthStart  = startOfMonth(now)
  const prevMonth   = startOfPrevMonth(now)
  const prev30days  = daysAgo(60)  // para calcular delta do período anterior
  const last30days  = daysAgo(30)

  const [
    totalLeadsRes,
    totalLeadsPrevRes,
    pipelineRes,
    activitiesTodayRes,
    activitiesYestRes,
    conversionsMonthRes,
    conversionsPrevRes,
    sourceRes,
    stageCardsRes,
    stagesRes,
    last30Res,
    recentRes,
  ] = await Promise.all([
    // Leads ativos totais (período atual — criados nos últimos 30 dias)
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),

    // Leads ativos criados entre 30-60 dias atrás (base de comparação)
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active')
      .gte('created_at', prev30days).lt('created_at', last30days),

    // Leads no pipeline
    supabase.from('pipeline_cards').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    // Atividades hoje
    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).gte('created_at', todayStart),

    // Atividades ontem (base de comparação)
    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', daysAgo(1)).lt('created_at', todayStart),

    // Conversões este mês
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'converted')
      .gte('updated_at', monthStart),

    // Conversões mês anterior
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'converted')
      .gte('updated_at', prevMonth).lt('updated_at', monthStart),

    // Leads por origem (apenas id + source, agrupado client-side)
    supabase.from('leads').select('source')
      .eq('tenant_id', tenantId).neq('status', 'archived'),

    // Cards por etapa (apenas stage_id)
    supabase.from('pipeline_cards').select('stage_id')
      .eq('tenant_id', tenantId),

    // Etapas do tenant
    supabase.from('pipeline_stages').select('id, name, color, position')
      .eq('tenant_id', tenantId).order('position'),

    // Leads criados nos últimos 30 dias (apenas created_at)
    supabase.from('leads').select('created_at')
      .eq('tenant_id', tenantId).gte('created_at', last30days)
      .order('created_at'),

    // Leads recentes (últimos 8)
    supabase.from('leads').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
      .limit(8),
  ])

  // ── Leads por origem ──────────────────────────────────────────────────────
  const sourceCounts = new Map<string, number>()
  for (const row of sourceRes.data ?? []) {
    sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1)
  }
  const leadsBySource: SourceCount[] = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source: source as LeadSource, count }))
    .sort((a, b) => b.count - a.count)

  // ── Leads por etapa ───────────────────────────────────────────────────────
  const stageCounts = new Map<string, number>()
  for (const row of stageCardsRes.data ?? []) {
    stageCounts.set(row.stage_id, (stageCounts.get(row.stage_id) ?? 0) + 1)
  }
  const leadsByStage: StageCount[] = (stagesRes.data ?? []).map((s) => ({
    stageId:   s.id,
    stageName: s.name,
    color:     s.color,
    count:     stageCounts.get(s.id) ?? 0,
  }))

  // ── Evolução últimos 30 dias ──────────────────────────────────────────────
  const dayMap = new Map<string, number>()
  for (const row of last30Res.data ?? []) {
    const key = row.created_at.slice(0, 10)
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  const leadsLast30Days = fillDayGaps(
    Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
    30,
  )

  return {
    totalLeads:           totalLeadsRes.count ?? 0,
    totalLeadsPrev:       totalLeadsPrevRes.count ?? 0,
    leadsInPipeline:      pipelineRes.count ?? 0,
    activitiesToday:      activitiesTodayRes.count ?? 0,
    activitiesYesterday:  activitiesYestRes.count ?? 0,
    conversionsThisMonth: conversionsMonthRes.count ?? 0,
    conversionsPrevMonth: conversionsPrevRes.count ?? 0,
    leadsBySource,
    leadsByStage,
    leadsLast30Days,
    recentLeads:          (recentRes.data ?? []) as Lead[],
  }
}
