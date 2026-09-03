import { supabase } from '@/lib/supabase'
import type { Lead, LeadSource } from '@/types'

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface SourceCount { source: LeadSource; count: number }
export interface StageCount  { stageId: string; stageName: string; color: string; count: number }
export interface DayCount    { date: string; count: number }

export interface PipelineFinancial {
  revenue:           number  // alias de faturamento (compat)
  faturamento:       number  // valor total vendido (leads.value dos ganhos, no período)
  receita:           number  // dinheiro de fato lançado/recebido, no período
  forecast:          number
  loss:              number
  won_count:         number
  lost_count:        number
  in_progress_count: number
  active_count:      number  // ativos sem estar no pipeline ainda
  total_with_value:  number
  avg_ticket:        number
  conversion_rate:   number
}

export interface DashboardMetrics {
  totalLeads:           number
  totalLeadsPrev:       number
  leadsInPipeline:      number
  activitiesToday:      number
  activitiesYesterday:  number
  conversionsThisMonth: number
  conversionsPrevMonth: number
  totalConverted:       number   // ganhos lifetime (count)
  totalLost:            number   // perdidos lifetime (count)
  monthlyRevenue:       number   // R$ entrada do mês (do financial_records, manual)
  conversionRate:       number   // % ganhos / (ganhos + perdidos)
  // Novos campos: financeiro automático baseado em pipeline + valor
  financial:            PipelineFinancial
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

// ── Faturamento x Receita (leve, sem o resto das métricas do dashboard) ───────

export interface FaturamentoReceita {
  faturamento: number  // valor total vendido (leads.value dos ganhos)
  receita:     number  // dinheiro de fato lançado/recebido
  wonCount:    number
}

export async function fetchFaturamentoReceita(
  tenantId: string, from?: string, to?: string,
): Promise<FaturamentoReceita> {
  const { data, error } = await supabase.rpc('get_pipeline_financial_metrics', {
    p_tenant_id: tenantId,
    p_from:      from ?? null,
    p_to:        to ?? null,
  })
  if (error) throw error
  const raw = (data as Record<string, unknown> | null) ?? {}
  return {
    faturamento: Number(raw.faturamento ?? raw.revenue ?? 0),
    receita:     Number(raw.receita ?? 0),
    wonCount:    Number(raw.won_count ?? 0),
  }
}

// ── Query principal ───────────────────────────────────────────────────────────

export async function fetchDashboardMetrics(
  tenantId: string,
  from?: string,
  to?: string,
  /** 'meus' = só os leads de quem está olhando. Vendedor é sempre 'meus',
      decidido no banco — mandar 'empresa' daqui não muda nada. */
  escopo?: 'meus' | 'empresa',
): Promise<DashboardMetrics> {
  const now        = new Date()
  const todayStart = startOfDay(now)
  const monthStart = startOfMonth(now)
  const prevMonth  = startOfPrevMonth(now)
  const prev30days = daysAgo(60)
  const last30days = daysAgo(30)

  const [
    totalLeadsRes, totalLeadsPrevRes, pipelineRes,
    activitiesTodayRes, activitiesYestRes,
    conversionsMonthRes, conversionsPrevRes,
    totalConvertedRes, totalLostRes,
    monthlyRevenueRes,
    financialRes,
    sourceRes, stageCardsRes, stagesRes, last30Res, recentRes,
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),

    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active')
      .gte('created_at', prev30days).lt('created_at', last30days),

    supabase.from('pipeline_cards').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).gte('created_at', todayStart),

    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).gte('created_at', daysAgo(1)).lt('created_at', todayStart),

    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'converted')
      .gte('updated_at', monthStart),

    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'converted')
      .gte('updated_at', prevMonth).lt('updated_at', monthStart),

    // Ganhos lifetime (total convertidos)
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'converted'),

    // Perdidos lifetime
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'lost'),

    // Receita do mês (tabela financial_records — manual)
    supabase.from('financial_records').select('amount')
      .eq('tenant_id', tenantId).eq('type', 'revenue')
      .gte('date', monthStart.slice(0, 10)),

    // Métricas financeiras automáticas via RPC — filtra por período se informado
    supabase.rpc('get_pipeline_financial_metrics', {
      p_tenant_id: tenantId,
      p_from:      from ?? null,
      p_to:        to ?? null,
      p_escopo:    escopo ?? null,
    }),

    supabase.from('leads').select('source')
      .eq('tenant_id', tenantId).neq('status', 'archived'),

    supabase.from('pipeline_cards').select('stage_id')
      .eq('tenant_id', tenantId),

    supabase.from('pipeline_stages').select('id, name, color, position')
      .eq('tenant_id', tenantId).order('position'),

    supabase.from('leads').select('created_at')
      .eq('tenant_id', tenantId).gte('created_at', last30days)
      .order('created_at'),

    supabase.from('leads').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false })
      .limit(8),
  ])

  // ── Soma da receita do mês ────────────────────────────────────────────────
  const monthlyRevenue = (monthlyRevenueRes.data ?? [])
    .reduce((sum, r: { amount: number }) => sum + Number(r.amount ?? 0), 0)

  // ── Taxa de conversão = ganhos / (ganhos + perdidos) * 100 ────────────────
  const won  = totalConvertedRes.count ?? 0
  const lost = totalLostRes.count ?? 0
  const conversionRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0

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

  // Financial metrics from RPC (force number — Supabase numeric pode vir como string)
  const rawFin = (financialRes.data as Record<string, unknown> | null) ?? {}
  const financial: PipelineFinancial = {
    revenue:           Number(rawFin.revenue ?? 0),
    faturamento:       Number(rawFin.faturamento ?? rawFin.revenue ?? 0),
    receita:           Number(rawFin.receita ?? 0),
    forecast:          Number(rawFin.forecast ?? 0),
    loss:              Number(rawFin.loss ?? 0),
    won_count:         Number(rawFin.won_count ?? 0),
    lost_count:        Number(rawFin.lost_count ?? 0),
    in_progress_count: Number(rawFin.in_progress_count ?? 0),
    active_count:      Number(rawFin.active_count ?? 0),
    total_with_value:  Number(rawFin.total_with_value ?? 0),
    avg_ticket:        Number(rawFin.avg_ticket ?? 0),
    conversion_rate:   Number(rawFin.conversion_rate ?? 0),
  }
  return {
    totalLeads:           totalLeadsRes.count ?? 0,
    totalLeadsPrev:       totalLeadsPrevRes.count ?? 0,
    leadsInPipeline:      pipelineRes.count ?? 0,
    activitiesToday:      activitiesTodayRes.count ?? 0,
    activitiesYesterday:  activitiesYestRes.count ?? 0,
    conversionsThisMonth: conversionsMonthRes.count ?? 0,
    conversionsPrevMonth: conversionsPrevRes.count ?? 0,
    totalConverted:       won,
    totalLost:            lost,
    monthlyRevenue,
    conversionRate,
    financial,
    leadsBySource,
    leadsByStage,
    leadsLast30Days,
    recentLeads:          (recentRes.data ?? []) as Lead[],
  }
}
