-- ================================================================
-- PROFILES: espelho de auth.users acessível via PostgREST
-- ================================================================

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Qualquer usuário autenticado vê perfis do mesmo tenant
create policy "tenant_members_see_profiles" on profiles
  for select using (
    id in (
      select user_id from user_memberships
      where tenant_id in (
        select tenant_id from user_memberships
        where user_id = auth.uid() and active = true
      )
    )
  );

-- O próprio usuário pode atualizar seu perfil
create policy "users_update_own_profile" on profiles
  for update using (id = auth.uid());

-- Trigger: popula profile automaticamente ao criar usuário no Supabase Auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ================================================================
-- TENANT_INVITES: convites por link (sem Edge Function)
-- ================================================================

create table if not exists tenant_invites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'seller',
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_by  uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

create index on tenant_invites (token);
create index on tenant_invites (tenant_id, email);

alter table tenant_invites enable row level security;

-- Admins do tenant criam e veem convites
create policy "admins_manage_invites" on tenant_invites
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role = 'admin' and active = true
    )
  );

-- Qualquer usuário autenticado pode ler um convite pelo token (para aceitar)
create policy "anyone_read_invite_by_token" on tenant_invites
  for select using (true);

-- ================================================================
-- RPC: aceitar convite (executado após o usuário criar a conta)
-- ================================================================

create or replace function accept_invite(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite tenant_invites;
  v_user_id uuid := auth.uid();
begin
  -- Busca convite válido
  select * into v_invite
  from tenant_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'Convite inválido ou expirado.');
  end if;

  -- Evita duplicata de membership
  insert into user_memberships (user_id, tenant_id, role)
  values (v_user_id, v_invite.tenant_id, v_invite.role)
  on conflict (user_id, tenant_id) do update
    set role = excluded.role, active = true;

  -- Marca convite como aceito
  update tenant_invites
  set accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('success', true, 'tenant_id', v_invite.tenant_id);
end;
$$;
