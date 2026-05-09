import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TenantUser {
  membershipId: string
  userId:       string
  email:        string
  fullName:     string | null
  role:         UserRole
  active:       boolean
  joinedAt:     string
}

export interface TenantInvite {
  id:          string
  email:       string
  role:        UserRole
  token:       string
  acceptedAt:  string | null
  expiresAt:   string
  createdAt:   string
}

// ── Listar membros do tenant ──────────────────────────────────────────────────

export async function fetchTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const { data, error } = await supabase
    .from('user_memberships')
    .select(`
      id,
      user_id,
      role,
      active,
      created_at,
      profiles ( email, full_name )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const profile = (row.profiles as unknown as { email: string; full_name: string | null } | null)
    return {
      membershipId: row.id,
      userId:       row.user_id,
      email:        profile?.email ?? '—',
      fullName:     profile?.full_name ?? null,
      role:         row.role as UserRole,
      active:       row.active,
      joinedAt:     row.created_at,
    }
  })
}

// ── Alterar role ──────────────────────────────────────────────────────────────

export async function updateUserRole(membershipId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('user_memberships')
    .update({ role })
    .eq('id', membershipId)

  if (error) throw error
}

// ── Ativar / desativar acesso ─────────────────────────────────────────────────

export async function setUserActive(membershipId: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_memberships')
    .update({ active })
    .eq('id', membershipId)

  if (error) throw error
}

// ── Convites ──────────────────────────────────────────────────────────────────

export async function fetchInvites(tenantId: string): Promise<TenantInvite[]> {
  const { data, error } = await supabase
    .from('tenant_invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id:         row.id,
    email:      row.email,
    role:       row.role as UserRole,
    token:      row.token,
    acceptedAt: row.accepted_at,
    expiresAt:  row.expires_at,
    createdAt:  row.created_at,
  }))
}

export async function createInvite(
  tenantId:  string,
  email:     string,
  role:      UserRole,
  createdBy: string,
): Promise<TenantInvite> {
  const { data, error } = await supabase
    .from('tenant_invites')
    .insert({ tenant_id: tenantId, email, role, created_by: createdBy })
    .select()
    .single()

  if (error) throw error

  return {
    id:         data.id,
    email:      data.email,
    role:       data.role as UserRole,
    token:      data.token,
    acceptedAt: data.accepted_at,
    expiresAt:  data.expires_at,
    createdAt:  data.created_at,
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('tenant_invites')
    .delete()
    .eq('id', inviteId)

  if (error) throw error
}

// ── Aceitar convite (chamado após o usuário se autenticar) ────────────────────

export async function acceptInvite(token: string): Promise<{ tenantId: string }> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { tenantId: data.tenant_id }
}

// ── Buscar convite pelo token (público — para exibir na página de aceite) ─────

export async function fetchInviteByToken(
  token: string,
): Promise<{ email: string; role: UserRole; tenantName: string; expiresAt: string } | null> {
  const { data, error } = await supabase
    .from('tenant_invites')
    .select(`*, tenants ( name )`)
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null

  return {
    email:      data.email,
    role:       data.role as UserRole,
    tenantName: (data.tenants as unknown as { name: string } | null)?.name ?? '—',
    expiresAt:  data.expires_at,
  }
}
