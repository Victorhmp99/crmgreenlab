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
  phone?: string
  email?: string
  status: LeadStatus
  source: LeadSource
  source_campaign?: string
  assigned_to?: string
  notes?: string
  tags?: string[]
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
  const payload = {
    tenant_id: tenantId,
    name: formData.name,
    phone: formData.phone || null,
    email: formData.email || null,
    status: formData.status,
    source: formData.source,
    source_campaign: formData.source_campaign || null,
    assigned_to: formData.assigned_to || null,
    notes: formData.notes || null,
    tags: formData.tags ?? [],
  }

  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateLead(id: string, formData: Partial<LeadFormData>): Promise<Lead> {
  const payload = {
    ...(formData.name !== undefined && { name: formData.name }),
    ...(formData.phone !== undefined && { phone: formData.phone || null }),
    ...(formData.email !== undefined && { email: formData.email || null }),
    ...(formData.status !== undefined && { status: formData.status }),
    ...(formData.source !== undefined && { source: formData.source }),
    ...(formData.source_campaign !== undefined && { source_campaign: formData.source_campaign || null }),
    ...(formData.assigned_to !== undefined && { assigned_to: formData.assigned_to || null }),
    ...(formData.notes !== undefined && { notes: formData.notes || null }),
    ...(formData.tags !== undefined && { tags: formData.tags }),
  }

  const { data, error } = await supabase.from('leads').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

export interface ImportLeadRow {
  name: string
  phone?: string
  email?: string
  source?: LeadSource
  source_campaign?: string
  notes?: string
}

export async function importLeads(tenantId: string, rows: ImportLeadRow[]): Promise<number> {
  const payload = rows.map((row) => ({
    tenant_id: tenantId,
    name: row.name,
    phone: row.phone || null,
    email: row.email || null,
    status: 'active' as LeadStatus,
    source: row.source ?? ('import' as LeadSource),
    source_campaign: row.source_campaign || null,
    notes: row.notes || null,
    tags: [],
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
