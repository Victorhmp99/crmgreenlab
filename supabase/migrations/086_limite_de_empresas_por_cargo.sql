-- Limite de criação de empresas por cargo.
--
-- Antes: sem limite, a não ser que o super admin preenchesse um override —
-- e a contagem somava TODAS as empresas em que a pessoa estava, inclusive
-- as que ela foi convidada. O Victor decidiu:
--
--   • conta só o que a pessoa CRIOU (tenants.owner_user_id), convite não conta;
--   • padrão pelo maior cargo: gestor 2, admin 10, super admin sem limite;
--   • o override (max_companies_override) continua existindo e vale acima do
--     padrão — mas só o super admin mexe nele. Antes admin também podia, e
--     poderia se dar "sem limite".

-- ── Regra em um lugar só ────────────────────────────────────────────────────
create or replace function public.limite_de_empresas(p_user_id uuid)
returns table (limite integer, criadas integer, origem text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_override integer;
  v_cargo    text;
begin
  select count(*)::int into criadas from tenants where owner_user_id = p_user_id;

  if exists (select 1 from super_admins where user_id = p_user_id) then
    limite := null; origem := 'super_admin'; return next; return;
  end if;

  select min(max_companies_override) into v_override
  from user_memberships where user_id = p_user_id and active and max_companies_override is not null;
  if v_override is not null then
    limite := v_override; origem := 'ajustado'; return next; return;
  end if;

  select case
           when bool_or(role = 'admin')   then 'admin'
           when bool_or(role = 'manager') then 'manager'
           else 'seller' end
    into v_cargo
  from user_memberships where user_id = p_user_id and active;

  limite := case v_cargo when 'admin' then 10 when 'manager' then 2 else 0 end;
  origem := 'padrao';
  return next;
end;
$$;
revoke all on function public.limite_de_empresas(uuid) from public, anon, authenticated;

-- O próprio usuário consulta o seu (pro botão "Nova empresa").
create or replace function public.meu_limite_de_empresas()
returns table (limite integer, criadas integer, origem text)
language sql
stable
security definer
set search_path = public
as $$ select * from limite_de_empresas(auth.uid()) $$;
revoke all on function public.meu_limite_de_empresas() from public, anon;
grant execute on function public.meu_limite_de_empresas() to authenticated;

-- ── Criar empresa respeita a regra e registra o dono ────────────────────────
create or replace function public.create_tenant_for_user(p_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id      uuid := auth.uid();
  v_membership   user_memberships%rowtype;
  v_tenant_id    uuid;
  v_final_slug   text;
  v_counter      int  := 1;
  v_lim          record;
  v_is_super     boolean;
  v_create_role  user_role;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Login necessário.');
  end if;

  select exists(select 1 from super_admins where user_id = v_user_id) into v_is_super;

  if v_is_super then
    v_create_role := 'admin';
  elsif exists(select 1 from user_memberships where user_id = v_user_id and active and role = 'admin') then
    v_create_role := 'admin';
  elsif exists(select 1 from user_memberships where user_id = v_user_id and active and role = 'manager') then
    v_create_role := 'manager';
  else
    return jsonb_build_object('error', 'Apenas admins e gestores podem criar empresas.');
  end if;

  select * into v_lim from limite_de_empresas(v_user_id);
  if v_lim.limite is not null and v_lim.criadas >= v_lim.limite then
    return jsonb_build_object('error', 'limit_reached:' || v_lim.limite::text);
  end if;

  if p_slug !~ '^[a-z0-9-]+$' then
    return jsonb_build_object('error', 'Slug inválido.');
  end if;

  v_final_slug := p_slug;
  while exists(select 1 from tenants where slug = v_final_slug) loop
    v_counter    := v_counter + 1;
    v_final_slug := p_slug || '-' || v_counter;
  end loop;

  insert into tenants (name, slug, plan, active, owner_user_id)
  values (p_name, v_final_slug, 'start', true, v_user_id)
  returning id into v_tenant_id;

  insert into user_memberships (user_id, tenant_id, role, active, account_status)
  values (v_user_id, v_tenant_id, v_create_role, true, 'active')
  returning * into v_membership;

  insert into tenant_settings (tenant_id, primary_color, secondary_color, webhook_key)
  values (v_tenant_id, '#00e676', '#00b248', gen_random_uuid())
  on conflict (tenant_id) do nothing;

  return jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant_id, 'name', p_name, 'slug', v_final_slug,
      'plan', 'start', 'active', true, 'created_at', now()
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id, 'user_id', v_user_id, 'tenant_id', v_tenant_id,
      'role', v_create_role::text, 'active', true, 'account_status', 'active',
      'status_changed_by', null, 'status_changed_at', null, 'created_at', v_membership.created_at
    )
  );
end;
$function$;

-- ── Ajustar limite: só super admin ──────────────────────────────────────────
create or replace function public.set_user_company_limit(p_membership_id uuid, p_limit integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from super_admins where user_id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if p_limit is not null and p_limit < 0 then
    raise exception 'Limite inválido.';
  end if;
  if not exists (select 1 from user_memberships where id = p_membership_id) then
    raise exception 'Membership não encontrada.';
  end if;
  update user_memberships set max_companies_override = p_limit where id = p_membership_id;
end;
$function$;
