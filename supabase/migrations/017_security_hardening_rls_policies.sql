-- ============================================================================
-- Migration 017 — Hardening de segurança (RLS + search_path)
--
-- Remove políticas de INSERT permissivas demais que abriam brechas, e fixa
-- search_path em funções auxiliares.
--
-- Contexto: todos os fluxos legítimos de criação (tenant, membership, profile)
-- passam por funções/triggers SECURITY DEFINER (register_new_tenant_with_admin,
-- accept_invite, handle_new_user) que ignoram RLS. Logo, essas políticas de
-- INSERT voltadas ao cliente eram desnecessárias.
-- ============================================================================

-- 🔴 CRÍTICO: fechava o isolamento entre empresas.
-- A política só validava user_id = auth.uid(), sem restringir tenant_id/role.
-- Um usuário logado podia se auto-inserir como admin de qualquer empresa cujo
-- UUID conhecesse (UUIDs de tenant não são segredo — aparecem no payload do
-- webhook, na URL do CRC, etc.), lendo os leads (PII) de outros tenants.
DROP POLICY IF EXISTS users_can_create_own_membership ON user_memberships;

-- 🟡 Qualquer autenticado podia criar tenants (spam). Criação real via RPC.
DROP POLICY IF EXISTS authenticated_users_can_create_tenant ON tenants;

-- 🟡 Permissiva (WITH CHECK true). profiles é criado pelo trigger
-- handle_new_user (SECURITY DEFINER) no signup — cliente nunca insere direto.
DROP POLICY IF EXISTS service_can_insert_profiles ON profiles;

-- 🟡 Hardening: fixa search_path em funções SECURITY INVOKER auxiliares.
ALTER FUNCTION public.normalize_phone(text)              SET search_path = public;
ALTER FUNCTION public.update_updated_at()                SET search_path = public;
ALTER FUNCTION public.trg_lead_tasks_updated()           SET search_path = public;
ALTER FUNCTION public.trg_lead_comments_set_updated_at() SET search_path = public;
