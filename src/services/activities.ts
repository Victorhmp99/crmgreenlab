import { supabase } from '@/lib/supabase'
import type { LeadActivity, ActivityType } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ActivityWithContext extends LeadActivity {
  lead_name: string
  user_email: string | null
}

export interface CreateActivityData {
  lead_id:     string
  type:        ActivityType
  description?: string
  followup_at?: string          // ISO date — próximo follow-up, guardado no metadata
}

export interface ActivityFilters {
  type?:      ActivityType | ''
  userId?:    string
  leadId?:    string
  dateFrom?:  string
  dateTo?:    string
  page?:      number
  pageSize?:  number
}

export interface PaginatedActivities {
  data:       ActivityWithContext[]
  count:      number
  page:       number
  pageSize:   number
  totalPages: number
}

export interface ActivityStats {
  today:     number
  thisWeek:  number
  thisMonth: number
}

// ── Listagem global paginada ───────────────────────────────────────────────────

export async function fetchActivities(
  tenantId: string,
  filters: ActivityFilters = {},
): Promise<PaginatedActivities> {
  const { type, userId, leadId, dateFrom, dateTo, page = 1, pageSize = 25 } = filters
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('lead_activities')
    .select(`*, leads(id, name)`, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type)     query = query.eq('type', type)
  if (userId)   query = query.eq('user_id', userId)
  if (leadId)   query = query.eq('lead_id', leadId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59')

  const { data, error, count } = await query
  if (error) throw error

  const rows: ActivityWithContext[] = (data ?? []).map((row) => ({
    id:          row.id,
    tenant_id:   row.tenant_id,
    lead_id:     row.lead_id,
    user_id:     row.user_id,
    type:        row.type as ActivityType,
    description: row.description,
    metadata:    row.metadata ?? {},
    created_at:  row.created_at,
    lead_name:   (row.leads as unknown as { name: string } | null)?.name ?? '—',
    // e-mail do usuário é guardado no metadata quando a atividade é criada
    user_email:  (row.metadata as Record<string, string>)?.user_email ?? null,
  }))

  return {
    data: rows,
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

// ── Timeline de um lead específico ───────────────────────────────────────────

export async function fetchLeadActivities(leadId: string): Promise<ActivityWithContext[]> {
  const { data, error } = await supabase
    .from('lead_activities')
    .select(`*, leads(id, name)`)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id:          row.id,
    tenant_id:   row.tenant_id,
    lead_id:     row.lead_id,
    user_id:     row.user_id,
    type:        row.type as ActivityType,
    description: row.description,
    metadata:    row.metadata ?? {},
    created_at:  row.created_at,
    lead_name:   (row.leads as unknown as { name: string } | null)?.name ?? '—',
    user_email:  (row.metadata as Record<string, string>)?.user_email ?? null,
  }))
}

// ── Criar nova atividade ──────────────────────────────────────────────────────

export async function createActivity(
  tenantId:  string,
  userId:    string,
  userEmail: string,
  data:      CreateActivityData,
): Promise<LeadActivity> {
  const payload = {
    tenant_id:   tenantId,
    lead_id:     data.lead_id,
    user_id:     userId,
    type:        data.type,
    description: data.description ?? null,
    metadata: {
      user_email:  userEmail,
      ...(data.followup_at ? { followup_at: data.followup_at } : {}),
    },
  }

  const { data: created, error } = await supabase
    .from('lead_activities')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return created as LeadActivity
}

// ── Estatísticas rápidas ──────────────────────────────────────────────────────

export async function fetchActivityStats(tenantId: string): Promise<ActivityStats> {
  const now         = new Date()
  const todayStart  = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart   = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayRes, weekRes, monthRes] = await Promise.all([
    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('type', 'in', '("stage_change","import")')
      .gte('created_at', todayStart.toISOString()),

    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('type', 'in', '("stage_change","import")')
      .gte('created_at', weekStart.toISOString()),

    supabase.from('lead_activities').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('type', 'in', '("stage_change","import")')
      .gte('created_at', monthStart.toISOString()),
  ])

  return {
    today:     todayRes.count  ?? 0,
    thisWeek:  weekRes.count   ?? 0,
    thisMonth: monthRes.count  ?? 0,
  }
}
