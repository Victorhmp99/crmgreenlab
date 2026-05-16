import { supabase } from '@/lib/supabase'

export interface LeadComment {
  id:         string
  tenant_id:  string
  lead_id:    string
  user_id:    string | null
  content:    string
  created_at: string
  updated_at: string
  user_name?: string | null
  user_email?: string | null
}

export interface CreateCommentData {
  lead_id: string
  content: string
}

// Busca perfis de uma lista de user_ids em uma query só
async function fetchProfileMap(userIds: string[]): Promise<Map<string, { name: string | null; email: string }>> {
  const map = new Map<string, { name: string | null; email: string }>()
  if (userIds.length === 0) return map
  const unique = Array.from(new Set(userIds))
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, email')
    .in('user_id', unique)
  for (const row of (data ?? []) as Array<{ user_id: string; full_name: string | null; email: string }>) {
    map.set(row.user_id, { name: row.full_name, email: row.email })
  }
  return map
}

export async function fetchLeadComments(leadId: string): Promise<LeadComment[]> {
  const { data, error } = await supabase
    .from('lead_comments')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as LeadComment[]

  const profiles = await fetchProfileMap(
    rows.map((r) => r.user_id).filter((id): id is string => !!id),
  )

  return rows.map((row) => {
    const p = row.user_id ? profiles.get(row.user_id) : null
    return {
      ...row,
      user_name:  p?.name  ?? null,
      user_email: p?.email ?? null,
    }
  })
}

export async function createComment(
  tenantId: string,
  userId:   string,
  data:     CreateCommentData,
): Promise<LeadComment> {
  const { data: created, error } = await supabase
    .from('lead_comments')
    .insert({
      tenant_id: tenantId,
      lead_id:   data.lead_id,
      user_id:   userId,
      content:   data.content.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return created as LeadComment
}

export async function updateComment(commentId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('lead_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)
  if (error) throw error
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('lead_comments')
    .delete()
    .eq('id', commentId)
  if (error) throw error
}
