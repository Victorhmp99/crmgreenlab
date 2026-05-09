-- ================================================================
-- LEAD_ACTIVITIES: histórico de disparos e interações
-- ================================================================

create type activity_type as enum (
  'call', 'whatsapp', 'email', 'meeting', 'note', 'stage_change', 'import'
);

create table if not exists lead_activities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  lead_id     uuid not null references leads(id) on delete cascade,
  user_id     uuid references auth.users(id),
  type        activity_type not null,
  description text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index on lead_activities (lead_id, created_at desc);
create index on lead_activities (tenant_id, user_id, created_at desc);

alter table lead_activities enable row level security;

create policy "tenant_members_see_activities" on lead_activities
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "tenant_members_create_activities" on lead_activities
  for insert with check (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );
