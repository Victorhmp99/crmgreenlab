-- ================================================================
-- PIPELINE: etapas do funil e posição dos leads no kanban
-- ================================================================

create table if not exists pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366F1',
  position   integer not null,
  is_final   boolean not null default false,
  created_at timestamptz not null default now()
);

create index on pipeline_stages (tenant_id, position);

alter table pipeline_stages enable row level security;

create policy "tenant_members_see_stages" on pipeline_stages
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "admins_manage_stages" on pipeline_stages
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin', 'manager') and active = true
    )
  );

-- Posição do lead no kanban (um lead por vez em uma etapa)
create table if not exists pipeline_cards (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  lead_id    uuid not null references leads(id) on delete cascade,
  stage_id   uuid not null references pipeline_stages(id),
  position   integer not null default 0,
  moved_at   timestamptz not null default now(),
  moved_by   uuid references auth.users(id),
  unique(lead_id)
);

create index on pipeline_cards (tenant_id, stage_id, position);

alter table pipeline_cards enable row level security;

create policy "tenant_members_see_cards" on pipeline_cards
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "tenant_members_manage_cards" on pipeline_cards
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

-- Seed de etapas padrão (inserido via função para usar o tenant_id correto)
create or replace function create_default_pipeline_stages(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  insert into pipeline_stages (tenant_id, name, color, position, is_final) values
    (p_tenant_id, 'Novo Lead',      '#6366F1', 0, false),
    (p_tenant_id, 'Contato Feito',  '#3B82F6', 1, false),
    (p_tenant_id, 'Agendado',       '#F59E0B', 2, false),
    (p_tenant_id, 'Em Negociação',  '#EC4899', 3, false),
    (p_tenant_id, 'Fechado',        '#10B981', 4, true),
    (p_tenant_id, 'Perdido',        '#EF4444', 5, true);
end;
$$;
