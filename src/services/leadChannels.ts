import { supabase } from '@/lib/supabase'
import type { LeadChannel } from '@/types'

export async function fetchLeadChannels(tenantId: string): Promise<LeadChannel[]> {
  const { data, error } = await supabase
    .from('lead_channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (error) throw error
  return (data ?? []) as LeadChannel[]
}

export async function createLeadChannel(
  tenantId: string,
  name:     string,
  color:    string,
): Promise<LeadChannel> {
  // Próxima posição
  const { data: existing } = await supabase
    .from('lead_channels')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPos = ((existing?.[0]?.position ?? -1) as number) + 1

  const { data, error } = await supabase
    .from('lead_channels')
    .insert({ tenant_id: tenantId, name: name.trim(), color, position: nextPos })
    .select()
    .single()

  if (error) throw error
  return data as LeadChannel
}

export async function updateLeadChannel(
  id:   string,
  data: Partial<Pick<LeadChannel, 'name' | 'color' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from('lead_channels').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteLeadChannel(id: string): Promise<void> {
  const { error } = await supabase.from('lead_channels').delete().eq('id', id)
  if (error) throw error
}
