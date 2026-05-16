import { supabase } from '@/lib/supabase'
import type { LeadTagDefinition } from '@/types'

// Lista todas as tags definidas no tenant (reutilizáveis)
export async function fetchTagDefinitions(tenantId: string): Promise<LeadTagDefinition[]> {
  const { data, error } = await supabase
    .from('lead_tag_definitions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw error
  return (data ?? []) as LeadTagDefinition[]
}

// Tags vinculadas a um lead específico
export async function fetchLeadTags(leadId: string): Promise<LeadTagDefinition[]> {
  const { data, error } = await supabase
    .from('lead_tag_links')
    .select('lead_tag_definitions(*)')
    .eq('lead_id', leadId)
  if (error) throw error
  // Supabase pode retornar como array OU objeto único dependendo da query
  return ((data ?? []) as unknown as Array<{
    lead_tag_definitions: LeadTagDefinition | LeadTagDefinition[] | null
  }>)
    .map((r) => Array.isArray(r.lead_tag_definitions) ? r.lead_tag_definitions[0] : r.lead_tag_definitions)
    .filter((t): t is LeadTagDefinition => t !== null && t !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createTagDefinition(
  tenantId: string, name: string, color: string,
): Promise<LeadTagDefinition> {
  const { data, error } = await supabase
    .from('lead_tag_definitions')
    .insert({ tenant_id: tenantId, name: name.trim(), color })
    .select()
    .single()
  if (error) throw error
  return data as LeadTagDefinition
}

export async function updateTagDefinition(
  id: string, data: Partial<Pick<LeadTagDefinition, 'name' | 'color'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name  !== undefined) payload.name  = data.name.trim()
  if (data.color !== undefined) payload.color = data.color
  const { error } = await supabase.from('lead_tag_definitions').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteTagDefinition(id: string): Promise<void> {
  const { error } = await supabase.from('lead_tag_definitions').delete().eq('id', id)
  if (error) throw error
}

// Sincroniza as tags de um lead (idempotente). Usa RPC que também atualiza leads.tags[] (compat).
export async function syncLeadTags(leadId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('sync_lead_tags', {
    p_lead_id: leadId,
    p_tag_ids: tagIds,
  })
  if (error) throw error
}
