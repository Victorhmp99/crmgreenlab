-- A telefonia estava restrita a `admin`, que neste produto é o nível de
-- REVENDA. Quem toca a operação de uma empresa é o GESTOR — e ele não
-- conseguia nem ver a tela de configuração da própria empresa.
--
-- Efeito prático: cada cliente dependia da Green Hub pra ligar a telefonia
-- dele, o que não escala e não faz sentido num produto vendido como serviço.
drop policy if exists admins_gerenciam_telefonia on telefonia_credenciais;
create policy gestores_gerenciam_telefonia on telefonia_credenciais
  for all using (
    is_tenant_manager(tenant_id)
    or exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  );

-- ── Definir o ramal de alguém ──────────────────────────────────────────────
-- user_memberships só aceita escrita de is_tenant_admin, então o gestor
-- tentaria salvar o ramal e receberia sucesso com ZERO linhas alteradas — o
-- campo voltaria vazio sem erro nenhum. É a mesma falha silenciosa que já
-- apareceu na troca de papel e na exclusão de empresa.
create or replace function definir_ramal(p_membership_id uuid, p_ramal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from user_memberships where id = p_membership_id;
  if v_tenant is null then
    raise exception 'Vínculo não encontrado';
  end if;

  if not is_tenant_manager(v_tenant)
     and not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Sem permissão para definir ramais nesta empresa';
  end if;

  update user_memberships
     set ramal = nullif(btrim(p_ramal), '')
   where id = p_membership_id;
end;
$$;

revoke all on function definir_ramal(uuid, text) from public, anon;
grant execute on function definir_ramal(uuid, text) to authenticated;

comment on function definir_ramal(uuid, text) is
  'Define o ramal de telefonia de um membro. Gestor e admin da própria empresa.';
