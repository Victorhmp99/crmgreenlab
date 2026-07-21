import { supabase } from '@/lib/supabase'
import type { LeadTask } from '@/types'

export interface LeadTaskWithMeta extends LeadTask {
  lead_name?:    string | null
  lead_company?: string | null
  lead_phone?:   string | null
  lead_email?:   string | null
  assignee_name?: string | null
  creator_name?: string | null
}

export interface CreateTaskData {
  lead_id?:     string | null
  assigned_to?: string | null
  title:        string
  description?: string | null
  due_at:       string
}

export interface UpdateTaskData {
  title?:       string
  description?: string | null
  due_at?:      string
  assigned_to?: string | null
  completed?:   boolean
}

export interface TaskFilters {
  from?:        string
  to?:          string
  assignedTo?:  string | 'me' | 'all'
  status?:      'pending' | 'completed' | 'overdue' | 'all'
  leadId?:      string
}

async function fetchProfileMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return map
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, email')
    .in('user_id', unique)
  for (const row of (data ?? []) as Array<{ user_id: string; full_name: string | null; email: string }>) {
    map.set(row.user_id, row.full_name ?? row.email)
  }
  return map
}

interface LeadInfo {
  name:    string
  company: string | null
  phone:   string | null
  email:   string | null
}

async function fetchLeadInfoMap(leadIds: string[]): Promise<Map<string, LeadInfo>> {
  const map = new Map<string, LeadInfo>()
  const unique = Array.from(new Set(leadIds.filter(Boolean)))
  if (unique.length === 0) return map
  const { data } = await supabase
    .from('leads')
    .select('id, name, company_name, phone, email')
    .in('id', unique)
  for (const row of (data ?? []) as Array<{ id: string; name: string; company_name: string | null; phone: string | null; email: string | null }>) {
    map.set(row.id, { name: row.name, company: row.company_name, phone: row.phone, email: row.email })
  }
  return map
}

export async function fetchTasks(
  tenantId: string,
  filters:  TaskFilters = {},
): Promise<LeadTaskWithMeta[]> {
  let query = supabase
    .from('lead_tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_at', { ascending: true })

  if (filters.from)   query = query.gte('due_at', filters.from)
  if (filters.to)     query = query.lte('due_at', filters.to)
  if (filters.leadId) query = query.eq('lead_id', filters.leadId)

  if (filters.assignedTo === 'me') {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) query = query.eq('assigned_to', userData.user.id)
  } else if (filters.assignedTo && filters.assignedTo !== 'all') {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  if (filters.status === 'pending') {
    query = query.eq('completed', false)
  } else if (filters.status === 'completed') {
    query = query.eq('completed', true)
  } else if (filters.status === 'overdue') {
    query = query.eq('completed', false).lt('due_at', new Date().toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as LeadTask[]

  const userIds = rows.flatMap((r) => [r.assigned_to, r.created_by]).filter((x): x is string => !!x)
  const leadIds = rows.map((r) => r.lead_id).filter((x): x is string => !!x)

  const [profiles, leadInfo] = await Promise.all([
    fetchProfileMap(userIds),
    fetchLeadInfoMap(leadIds),
  ])

  return rows.map((r) => {
    const lead = r.lead_id ? leadInfo.get(r.lead_id) : null
    return {
      ...r,
      lead_name:     lead?.name    ?? null,
      lead_company:  lead?.company ?? null,
      lead_phone:    lead?.phone   ?? null,
      lead_email:    lead?.email   ?? null,
      assignee_name: r.assigned_to ? profiles.get(r.assigned_to) ?? null : null,
      creator_name:  r.created_by  ? profiles.get(r.created_by)  ?? null : null,
    }
  })
}

export async function fetchLeadTasks(leadId: string): Promise<LeadTaskWithMeta[]> {
  const { data, error } = await supabase
    .from('lead_tasks')
    .select('*')
    .eq('lead_id', leadId)
    .order('due_at', { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as LeadTask[]

  const userIds = rows.flatMap((r) => [r.assigned_to, r.created_by]).filter((x): x is string => !!x)
  const profiles = await fetchProfileMap(userIds)

  return rows.map((r) => ({
    ...r,
    lead_name:     null,
    lead_company:  null,
    lead_phone:    null,
    lead_email:    null,
    assignee_name: r.assigned_to ? profiles.get(r.assigned_to) ?? null : null,
    creator_name:  r.created_by  ? profiles.get(r.created_by)  ?? null : null,
  }))
}

export async function createTask(
  tenantId: string, userId: string, data: CreateTaskData,
): Promise<LeadTask> {
  const { data: created, error } = await supabase
    .from('lead_tasks')
    .insert({
      tenant_id:   tenantId,
      lead_id:     data.lead_id ?? null,
      created_by:  userId,
      assigned_to: data.assigned_to ?? null,
      title:       data.title.trim(),
      description: data.description ?? null,
      due_at:      data.due_at,
    })
    .select()
    .single()
  if (error) throw error
  return created as LeadTask
}

export async function updateTask(id: string, data: UpdateTaskData): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.title       !== undefined) payload.title       = data.title.trim()
  if (data.description !== undefined) payload.description = data.description
  if (data.due_at      !== undefined) payload.due_at      = data.due_at
  if (data.assigned_to !== undefined) payload.assigned_to = data.assigned_to
  if (data.completed   !== undefined) {
    payload.completed = data.completed
    payload.completed_at = data.completed ? new Date().toISOString() : null
  }
  const { error } = await supabase.from('lead_tasks').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('lead_tasks').delete().eq('id', id)
  if (error) throw error
}

// Apaga várias tarefas de uma vez (usado pelos botões "Limpar concluídas"/"Limpar tudo")
export async function deleteTasks(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('lead_tasks').delete().in('id', ids)
  if (error) throw error
}
