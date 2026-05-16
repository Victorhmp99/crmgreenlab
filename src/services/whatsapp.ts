import { supabase } from '@/lib/supabase'
import type { WhatsappSettings } from '@/types'

export async function fetchWhatsappSettings(tenantId: string): Promise<WhatsappSettings | null> {
  const { data, error } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data as WhatsappSettings | null
}

export interface UpdateWhatsappSettingsData {
  evolution_url?:      string | null
  instance_name?:      string | null
  default_stage_id?:   string | null
  default_channel_id?: string | null
  active?:             boolean
}

export async function updateWhatsappSettings(
  tenantId: string,
  data:     UpdateWhatsappSettingsData,
): Promise<void> {
  // upsert: se não existir cria
  const { data: existing } = await supabase
    .from('whatsapp_settings')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('whatsapp_settings')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('whatsapp_settings')
      .insert({ tenant_id: tenantId, ...data })
    if (error) throw error
  }
}

export async function regenerateWhatsappToken(tenantId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_whatsapp_token', { p_tenant_id: tenantId })
  if (error) throw error
  return data as string
}
