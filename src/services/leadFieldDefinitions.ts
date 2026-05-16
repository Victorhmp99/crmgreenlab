import { supabase } from '@/lib/supabase'
import type { LeadFieldDefinition, LeadFieldType } from '@/types'

// ── Tipos auxiliares ─────────────────────────────────────────────────────────

export interface CreateFieldData {
  label:      string
  field_key:  string
  field_type: LeadFieldType
  options?:   string[] | null
  required?:  boolean
}

export type UpdateFieldData = Partial<Pick<LeadFieldDefinition,
  'label' | 'options' | 'required' | 'active'
>>

// ── Listar (RPC com bypass de RLS) ──────────────────────────────────────────

export async function fetchLeadFields(tenantId: string): Promise<LeadFieldDefinition[]> {
  const { data, error } = await supabase.rpc('get_lead_field_definitions', { p_tenant_id: tenantId })
  if (error) throw error

  // RPC retorna field_position (não pode usar 'position' que é reservada no PG)
  return ((data ?? []) as Array<{
    id: string; label: string; field_key: string; field_type: LeadFieldType;
    options: string[] | null; required: boolean; active: boolean;
    field_position: number; created_at: string;
  }>).map((row) => ({
    id:         row.id,
    label:      row.label,
    field_key:  row.field_key,
    field_type: row.field_type,
    options:    row.options,
    required:   row.required,
    active:     row.active,
    position:   row.field_position,
    created_at: row.created_at,
  }))
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createLeadField(
  tenantId: string,
  data:     CreateFieldData,
): Promise<LeadFieldDefinition> {
  // Próxima posição
  const { data: existing } = await supabase
    .from('lead_field_definitions')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPos = ((existing?.[0]?.position ?? -1) as number) + 1

  const { data: { user } } = await supabase.auth.getUser()

  const { data: created, error } = await supabase
    .from('lead_field_definitions')
    .insert({
      tenant_id:  tenantId,
      label:      data.label,
      field_key:  data.field_key,
      field_type: data.field_type,
      options:    data.options ?? null,
      required:   data.required ?? false,
      active:     true,
      position:   nextPos,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return created as LeadFieldDefinition
}

// Edita só label, options, required e active.
// field_key e field_type NÃO podem ser alterados após criação (preserva integridade dos dados).
export async function updateLeadField(id: string, data: UpdateFieldData): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.label    !== undefined) payload.label    = data.label
  if (data.options  !== undefined) payload.options  = data.options
  if (data.required !== undefined) payload.required = data.required
  if (data.active   !== undefined) payload.active   = data.active

  const { error } = await supabase.from('lead_field_definitions').update(payload).eq('id', id)
  if (error) throw error
}

// Soft-delete: marca como inativo, preserva dados em leads.custom_fields
export async function deactivateLeadField(id: string): Promise<void> {
  const { error } = await supabase
    .from('lead_field_definitions')
    .update({ active: false })
    .eq('id', id)
  if (error) throw error
}

export async function reorderLeadFields(
  tenantId: string,
  updates: Array<{ id: string; position: number }>,
): Promise<void> {
  const { error } = await supabase.rpc('reorder_lead_field_definitions', {
    p_tenant_id: tenantId,
    p_updates:   updates,
  })
  if (error) throw error
}

// ── Helpers de slug ──────────────────────────────────────────────────────────

// Converte "Qual sua Especialidade?" → "qual_sua_especialidade"
export function labelToFieldKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}
