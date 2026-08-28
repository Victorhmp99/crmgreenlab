-- ── 1. Exclusão de empresa que realmente exclui ────────────────────────────
--
-- A tela apagava tabela por tabela pelo navegador e por último `tenants`.
-- Só que `tenants` tem RLS com política APENAS de SELECT: sem política de
-- DELETE, o Postgres não apaga nada e devolve sucesso com zero linhas. Nenhum
-- erro em lugar nenhum — a empresa continuava lá e a tela dizia que deu certo.
--
-- Também não era atômico: se parasse no meio, a empresa ficava sem pipeline e
-- sem leads, mas existindo.
--
-- Todas as 29 tabelas que referenciam tenants são ON DELETE CASCADE, então
-- apagar a linha da empresa já leva o resto junto. A cadeia manual nunca foi
-- necessária.
create or replace function delete_tenant_completely(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apagadas integer;
begin
  if not exists (select 1 from super_admins sa where sa.user_id = auth.uid()) then
    raise exception 'Unauthorized: super admin only';
  end if;

  -- Impedir no servidor, não só na tela: apagar a própria empresa derrubaria
  -- o acesso de quem está executando, sem volta.
  if exists (
    select 1 from user_memberships um
    where um.tenant_id = p_tenant_id and um.user_id = auth.uid() and um.active
  ) then
    raise exception 'Não é possível excluir a empresa à qual você pertence';
  end if;

  -- Sem FK, não sai por cascata.
  delete from webhook_rate_limits where tenant_id = p_tenant_id;

  delete from tenants where id = p_tenant_id;
  get diagnostics v_apagadas = row_count;

  -- Devolve a contagem pra tela conseguir distinguir "apagou" de "não achou".
  -- É essa diferença que faltava pra o defeito ter aparecido no primeiro uso.
  return v_apagadas;
end;
$$;

revoke all on function delete_tenant_completely(uuid) from public, anon;
grant execute on function delete_tenant_completely(uuid) to authenticated;

comment on function delete_tenant_completely(uuid) is
  'Exclui a empresa e tudo que depende dela (por cascata), atomicamente. Só super admin, e nunca a própria empresa.';

-- ── 2. Dono de cada empresa na listagem ────────────────────────────────────
-- Não existe coluna de criador em `tenants`. O dono é derivado: o admin mais
-- antigo daquela empresa — que na prática é quem a criou, já que quem cria
-- entra como admin. Sem admin, cai pro membro mais antigo, pra linha nunca
-- ficar em branco sem explicação.
drop function if exists get_platform_stats();

create function get_platform_stats()
returns table (
  tenant_id uuid, tenant_name text, tenant_slug text, tenant_plan text,
  tenant_active boolean, tenant_created_at timestamptz,
  user_count bigint, lead_count bigint, tenant_features text[],
  owner_name text, owner_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Unauthorized: super admin only';
  end if;

  return query
  select
    t.id, t.name, t.slug, t.plan, t.active, t.created_at,
    count(distinct um.user_id)::bigint,
    count(distinct l.id)::bigint,
    t.features,
    dono.full_name,
    dono.email
  from tenants t
  left join user_memberships um on um.tenant_id = t.id and um.active = true
  left join leads l             on l.tenant_id  = t.id
  left join lateral (
    select p.full_name, p.email
    from user_memberships m
    join profiles p on p.id = m.user_id
    where m.tenant_id = t.id and m.active
    -- admin primeiro; entre iguais, o mais antigo
    order by (m.role <> 'admin'), m.created_at
    limit 1
  ) dono on true
  group by t.id, t.name, t.slug, t.plan, t.active, t.created_at, t.features,
           dono.full_name, dono.email
  order by t.created_at desc;
end;
$$;

revoke all on function get_platform_stats() from public, anon;
grant execute on function get_platform_stats() to authenticated;
