-- ================================================================
-- FINANCIAL & CAMPAIGNS: Revenue Center + Meta Ads (Fase 3)
-- ================================================================

create type record_type as enum ('revenue', 'expense');

create table if not exists financial_records (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  type        record_type not null,
  category    text,
  description text,
  amount      numeric(12, 2) not null,
  date        date not null,
  lead_id     uuid references leads(id),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index on financial_records (tenant_id, date desc);

alter table financial_records enable row level security;

create policy "managers_see_financial" on financial_records
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );

create policy "managers_manage_financial" on financial_records
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );

-- Campanhas Meta Ads
create table if not exists campaigns (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  external_id     text not null,
  name            text not null,
  platform        text not null default 'meta',
  status          text,
  spend           numeric(12, 2),
  impressions     integer,
  clicks          integer,
  leads_generated integer,
  synced_at       timestamptz not null default now()
);

create index on campaigns (tenant_id, synced_at desc);

alter table campaigns enable row level security;

create policy "managers_see_campaigns" on campaigns
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );

create policy "admins_manage_campaigns" on campaigns
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role = 'admin' and active = true
    )
  );
