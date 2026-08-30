import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TenantUser {
  membershipId:          string
  userId:                string
  email:                 string
  fullName:              string | null
  role:                  UserRole
  active:                boolean
  joinedAt:              string
  tenantName:            string
  tenantId:              string
  maxCompaniesOverride:  number | null
  /** Criador da empresa: ninguém pode alterar nem remover o acesso dele. */
  isOwner:               boolean
  /** Ramal na telefonia. Sem ele a pessoa não consegue discar pelo CRM. */
  ramal:                 string | null
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
  // Usa RPC SECURITY DEFINER que bypassa RLS — garante que admin enxerga todos do tenant
  const { data, error } = await supabase.rpc('get_tenant_users', { p_tenant_id: tenantId })

  if (error) throw error

  return ((data ?? []) as Array<{
    membership_id: string; user_id: string; email: string | null;
    full_name: string | null; role: string; active: boolean;
    account_status: string; joined_at: string;
    tenant_name: string; tenant_id: string;
    max_companies_override: number | null; is_owner: boolean; ramal: string | null;
  }>).map((row) => ({
    membershipId:         row.membership_id,
    userId:               row.user_id,
    email:                row.email ?? '—',
    fullName:             row.full_name,
    role:                 row.role as UserRole,
    active:               row.active,
    joinedAt:             row.joined_at,
    tenantName:           row.tenant_name,
    tenantId:             row.tenant_id,
    maxCompaniesOverride: row.max_companies_override ?? null,
    isOwner:              row.is_owner === true,
    ramal:                row.ramal ?? null,
  }))
}

// ── Alterar role ──────────────────────────────────────────────────────────────

/**
 * Altera o papel de um membro.
 *
 * Vai por RPC, não por update direto: a tabela só aceita escrita de
 * `is_tenant_admin`, então gestor recebia sucesso com zero linhas alteradas —
 * a tela dizia que salvou e nada mudava. E toda a regra de hierarquia ficava
 * só no navegador, que qualquer um contorna chamando a API direto.
 */
export async function updateUserRole(membershipId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    p_membership_id: membershipId,
    p_role:          role,
  })

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
  // Usa RPC SECURITY DEFINER para garantir leitura
  const { data, error } = await supabase.rpc('get_tenant_invites', { p_tenant_id: tenantId })

  if (error) throw error

  return ((data ?? []) as Array<{
    id: string; email: string; role: string; token: string;
    accepted_at: string | null; expires_at: string; created_at: string;
  }>).map((row) => ({
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

// ── Definir limite de empresas por usuário ────────────────────────────────────

export async function setUserCompanyLimit(
  membershipId: string,
  limit: number | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_user_company_limit', {
    p_membership_id: membershipId,
    p_limit:         limit,
  })
  if (error) throw error
}

// ── Remover membership (excluir usuário da empresa) ──────────────────────────

export async function removeMember(membershipId: string): Promise<void> {
  const { data, error } = await supabase.rpc('remove_member', { p_membership_id: membershipId })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
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
  // Usa RPC SECURITY DEFINER que pode ser chamada por anon (usuário não logado)
  const { data, error } = await supabase.rpc('get_invite_info', { p_token: token })

  if (error || !data) return null

  // RPC retorna json com email, role, tenant_name, expires_at
  const info = data as { email: string; role: string; tenant_name: string; expires_at: string }
  return {
    email:      info.email,
    role:       info.role as UserRole,
    tenantName: info.tenant_name,
    expiresAt:  info.expires_at,
  }
}
