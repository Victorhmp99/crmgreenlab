-- ================================================================
-- TENANTS: cada clínica/agência é um tenant isolado
-- ================================================================

create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  plan       text not null default 'trial',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tenant_settings (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  logo_url        text,
  primary_color   text not null default '#2563EB',
  secondary_color text not null default '#1E40AF',
  custom_domain   text unique,
  updated_at      timestamptz not null default now()
);

-- RLS
alter table tenants enable row level security;
alter table tenant_settings enable row level security;

-- Tenants: usuário vê apenas tenants dos quais é membro
create policy "members_see_own_tenant" on tenants
  for select using (
    id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

-- Settings: mesmo isolamento
create policy "members_see_tenant_settings" on tenant_settings
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "admins_update_tenant_settings" on tenant_settings
  for update using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role = 'admin' and active = true
    )
  );
