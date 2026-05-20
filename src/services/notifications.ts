import { supabase } from '@/lib/supabase'

export interface Notification {
  id:           string
  tenant_id:    string | null
  recipient_id: string
  created_by:   string | null
  title:        string
  body:         string
  link:         string | null
  read_at:      string | null
  created_at:   string
}

export async function fetchMyNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []) as Notification[]
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) throw error
}

export async function markAllAsRead(): Promise<void> {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.user.id)
    .is('read_at', null)
  if (error) throw error
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
}

export async function clearAllNotifications(): Promise<void> {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_id', user.user.id)
  if (error) throw error
}

// ── Super Admin Master only ──────────────────────────────────────────────────

export async function sendNotification(
  recipientIds: string[],
  title:        string,
  body:         string,
  link?:        string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('send_notification', {
    p_recipient_ids: recipientIds,
    p_title:         title,
    p_body:          body,
    p_link:          link ?? null,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function broadcastNotification(
  title: string,
  body:  string,
  link?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('broadcast_notification', {
    p_title: title,
    p_body:  body,
    p_link:  link ?? null,
  })
  if (error) throw error
  return Number(data ?? 0)
}
