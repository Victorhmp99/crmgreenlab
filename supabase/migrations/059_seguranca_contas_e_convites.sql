-- Auditoria de segurança da área de contas. Migrations 063 a 066 no Supabase,
-- aplicadas em 28/08/2026.

-- ── 1. VAZAMENTO: convites de todas as empresas eram públicos ──────────────
-- A política `anyone_read_invite_by_token` liberava SELECT em tenant_invites
-- com `using (true)` — inclusive SEM LOGIN. Como a chave pública do Supabase
-- vai dentro do próprio site, bastava uma requisição pra listar todos os
-- convites de todas as empresas: e-mail, papel, tenant_id e token.
--
-- Não dava pra sequestrar conta (accept_invite confere se o e-mail do convite
-- bate com o de quem está logado), mas vazava a lista de quem cada cliente
-- estava contratando.
--
-- A política era dispensável desde sempre: a tela de aceite lê pelo RPC
-- get_invite_info (devolve UM convite pelo token).
drop policy if exists anyone_read_invite_by_token on tenant_invites;

-- ── 2. delete_pipeline apagava funil de empresa alheia ─────────────────────
-- O único teste era se a pipeline pertence ao tenant informado — conferia a
-- coerência dos dois argumentos, não a autorização de quem chama. Ver
-- migration 064 no Supabase: agora exige is_tenant_manager daquela empresa.

-- ── 3. debug_funnel expunha métricas de qualquer empresa ───────────────────
-- Devolvia total de leads, convertidos, perdidos e atividades de QUALQUER
-- empresa cujo id fosse informado, pra qualquer usuário logado. Agora exige
-- is_tenant_member.

-- ── 4. match_or_create_lead_by_phone criava lead em empresa alheia ─────────
-- Função de integração do WhatsApp (roda por service_role). Não havia motivo
-- pra ficar aberta a usuário logado. EXECUTE revogado de authenticated/anon.

-- ── 5. ESCALADA: admin podia convidar outro admin ──────────────────────────
-- O gatilho validate_invite_role restringia gestor e vendedor, mas NÃO
-- restringia admin — e admin é nível de revenda, que só o super admin cria. A
-- tela nunca ofereceu a opção, mas o convite é INSERT direto na tabela.
-- Regra única agora (migration 066): super admin faz tudo; vendedor não
-- convida; ninguém que não seja super admin concede 'admin'; gestor e admin
-- convidam vendedor e gestor.

-- ── 6. Visão de conta: em quantas empresas a pessoa está ───────────────────
create or replace function get_user_companies(p_user_id uuid)
returns table (
  tenant_id uuid, tenant_name text, role text, active boolean,
  is_owner boolean, joined_at timestamptz, lead_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só super admin: é uma visão que atravessa empresas, exatamente o tipo de
  -- coisa que não pode ficar aberta pra gestor.
  if not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Unauthorized: super admin only';
  end if;

  return query
  select t.id, t.name, m.role::text, m.active,
         (t.owner_user_id = m.user_id),
         m.created_at,
         (select count(*) from leads l where l.tenant_id = t.id)::bigint
  from user_memberships m
  join tenants t on t.id = m.tenant_id
  where m.user_id = p_user_id
  order by m.created_at;
end;
$$;

revoke all on function get_user_companies(uuid) from public, anon;
grant execute on function get_user_companies(uuid) to authenticated;
