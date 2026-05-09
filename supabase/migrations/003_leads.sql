-- ================================================================
-- LEADS: o coração do CRM
-- ================================================================

create type lead_status as enum ('active', 'converted', 'lost', 'archived');
create type lead_source as enum ('manual', 'import', 'meta_ads', 'google', 'referral', 'other');

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  assigned_to     uuid references auth.users(id),
  name            text not null,
  phone           text,
  email           text,
  status          lead_status not null default 'active',
  source          lead_source not null default 'manual',
  source_campaign text,
  notes           text,
  tags            text[] not null default '{}',
  custom_fields   jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on leads (tenant_id, status);
create index on leads (tenant_id, assigned_to);
create index on leads (tenant_id, created_at desc);

alter table leads enable row level security;

-- Membros do tenant veem todos os leads
create policy "tenant_members_see_leads" on leads
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

-- Membros podem criar leads
create policy "tenant_members_create_leads" on leads
  for insert with check (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

-- Membros podem editar leads do seu tenant
create policy "tenant_members_update_leads" on leads
  for update using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

-- Admins e managers podem deletar
create policy "managers_delete_leads" on leads
  for delete using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );

-- Trigger para atualizar updated_at automaticamente
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();
