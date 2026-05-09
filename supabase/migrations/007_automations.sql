-- ================================================================
-- AUTOMATIONS: regras simples de automação (Fase 2)
-- ================================================================

create type automation_trigger as enum (
  'stage_change', 'activity_created', 'lead_created', 'goal_reached'
);
create type automation_action as enum (
  'move_stage', 'notify_user', 'assign_lead', 'add_tag'
);

create table if not exists automations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  active         boolean not null default true,
  trigger_type   automation_trigger not null,
  trigger_config jsonb not null default '{}',
  action_type    automation_action not null,
  action_config  jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

alter table automations enable row level security;

create policy "members_see_automations" on automations
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "admins_manage_automations" on automations
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );
