-- ================================================================
-- GOALS: metas por vendedor e período
-- ================================================================

create type goal_period as enum ('daily', 'weekly', 'monthly', 'quarterly');

create table if not exists goals (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  user_id        uuid not null references auth.users(id),
  period         goal_period not null,
  start_date     date not null,
  end_date       date not null,
  leads_target   integer,
  calls_target   integer,
  deals_target   integer,
  revenue_target numeric(12, 2),
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index on goals (tenant_id, user_id, start_date);

alter table goals enable row level security;

-- Sellers veem apenas suas próprias metas; managers/admins veem todas do tenant
create policy "members_see_goals" on goals
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
    and (
      user_id = auth.uid()
      or exists (
        select 1 from user_memberships
        where user_id = auth.uid()
          and tenant_id = goals.tenant_id
          and role in ('admin', 'manager')
          and active = true
      )
    )
  );

create policy "managers_manage_goals" on goals
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );
