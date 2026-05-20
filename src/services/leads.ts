import { supabase } from '@/lib/supabase'
import type { Lead, LeadStatus, LeadSource } from '@/types'

export interface LeadFilters {
  search?: string
  status?: LeadStatus | ''
  source?: LeadSource | ''
  assignedTo?: string
  page?: number
  pageSize?: number
}

export interface LeadFormData {
  name: string
  company_name?: string
  phone?: string
  email?: string
  status: LeadStatus
  source: LeadSource
  source_campaign?: string
  assigned_to?: string
  notes?: string
  tags?: string[]
  value?: number | null
  channel_id?: string | null
  custom_fields?: Record<string, unknown>
}

export interface PaginatedLeads {
  data: Lead[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export async function fetchLeads(tenantId: string, filters: LeadFilters = {}): Promise<PaginatedLeads> {
  const { search, status, source, assignedTo, page = 1, pageSize = 20 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

export async function fetchLeadById(id: string): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createLead(tenantId: string, formData: LeadFormData): Promise<Lead> {
  // Se não veio assigned_to, atribui ao usuário logado (criador)
  let assignedTo = formData.assigned_to ?? null
  if (!assignedTo) {
    const { data: { user } } = await supabase.auth.getUser()
    assignedTo = user?.id ?? null
  }

  const payload = {
    tenant_id: tenantId,
    name: formData.name,
    company_name: formData.company_name || null,
    phone: formData.phone || null,
    email: formData.email || null,
    status: formData.status,
    source: formData.source,
    source_campaign: formData.source_campaign || null,
    assigned_to: assignedTo,
    notes: formData.notes || null,
    tags: formData.tags ?? [],
    value: formData.value ?? null,
    channel_id: formData.channel_id ?? null,
    custom_fields: formData.custom_fields ?? {},
  }

  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateLead(id: string, formData: Partial<LeadFormData>): Promise<Lead> {
  const payload = {
    ...(formData.name !== undefined && { name: formData.name }),
    ...(formData.company_name !== undefined && { company_name: formData.company_name || null }),
    ...(formData.phone !== undefined && { phone: formData.phone || null }),
    ...(formData.email !== undefined && { email: formData.email || null }),
    ...(formData.status !== undefined && { status: formData.status }),
    ...(formData.source !== undefined && { source: formData.source }),
    ...(formData.source_campaign !== undefined && { source_campaign: formData.source_campaign || null }),
    ...(formData.assigned_to !== undefined && { assigned_to: formData.assigned_to || null }),
    ...(formData.notes !== undefined && { notes: formData.notes || null }),
    ...(formData.tags !== undefined && { tags: formData.tags }),
    ...(formData.value !== undefined && { value: formData.value }),
    ...(formData.channel_id !== undefined && { channel_id: formData.channel_id }),
    ...(formData.custom_fields !== undefined && { custom_fields: formData.custom_fields }),
  }

  const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLead(id: string): Promise<void> {
  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) {
    console.error('[leads] deleteLead falhou:', error)
    throw error
  }
  if (count === 0) {
    throw new Error('Não foi possível excluir. Verifique sua permissão (RLS) ou rode o SQL fixes_delete_and_notifications.sql.')
  }
}

// Bulk delete — RLS aplica linha a linha, então só vai apagar o que o usuário tem permissão.
export async function deleteLeadsBulk(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .in('id', ids)
  if (error) throw error
  return count ?? 0
}

export interface ImportLeadRow {
  name:             string
  company_name?:    string
  phone?:           string
  email?:           string
  status?:          LeadStatus
  source?:          LeadSource
  source_campaign?: string
  notes?:           string
  channel_id?:      string | null
  value?:           number | null
  tags?:            string[]
  custom_fields?:   Record<string, unknown>
}

export async function importLeads(tenantId: string, rows: ImportLeadRow[]): Promise<number> {
  const payload = rows.map((row) => ({
    tenant_id:       tenantId,
    name:            row.name,
    company_name:    row.company_name || null,
    phone:           row.phone || null,
    email:           row.email || null,
    status:          row.status ?? ('active' as LeadStatus),
    source:          row.source ?? ('import' as LeadSource),
    source_campaign: row.source_campaign || null,
    notes:           row.notes || null,
    tags:            row.tags ?? [],
    channel_id:      row.channel_id ?? null,
    value:           row.value ?? null,
    custom_fields:   row.custom_fields ?? {},
  }))

  // Insere em lotes de 100 para não sobrecarregar o Supabase
  const BATCH_SIZE = 100
  let imported = 0

  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('leads').insert(batch)
    if (error) throw error
    imported += batch.length
  }

  return imported
}
