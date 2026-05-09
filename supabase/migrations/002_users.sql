-- ================================================================
-- USER_MEMBERSHIPS: N usuários por N tenants com roles
-- ================================================================

create type user_role as enum ('admin', 'manager', 'seller');

create table if not exists user_memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  role       user_role not null default 'seller',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, tenant_id)
);

-- Índice para lookup rápido por usuário
create index on user_memberships (user_id, tenant_id);

alter table user_memberships enable row level security;

-- Usuário vê apenas seus próprios memberships
create policy "users_see_own_memberships" on user_memberships
  for select using (user_id = auth.uid());

-- Admin pode gerenciar memberships do seu tenant
create policy "admins_manage_memberships" on user_memberships
  for all using (
    tenant_id in (
      select tenant_id from user_memberships m
      where m.user_id = auth.uid() and m.role = 'admin' and m.active = true
    )
  );
