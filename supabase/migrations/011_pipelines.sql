-- ================================================================
-- PIPELINES: múltiplos funis por tenant (Inbound, Outbound, etc.)
-- ================================================================

create table if not exists pipelines (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#6366F1',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on pipelines (tenant_id, position);

alter table pipelines enable row level security;

create policy "tenant_members_see_pipelines" on pipelines
  for select using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and active = true
    )
  );

create policy "managers_manage_pipelines" on pipelines
  for all using (
    tenant_id in (
      select tenant_id from user_memberships
      where user_id = auth.uid() and role in ('admin','manager') and active = true
    )
  );

-- ── Adicionar pipeline_id em pipeline_stages ─────────────────────────────────

alter table pipeline_stages
  add column if not exists pipeline_id uuid references pipelines(id) on delete cascade;

-- Para tenants com etapas existentes sem pipeline_id: criar pipeline padrão e migrar
do $$
declare
  v_tenant_id uuid;
  v_pipeline_id uuid;
begin
  for v_tenant_id in
    select distinct tenant_id from pipeline_stages where pipeline_id is null
  loop
    insert into pipelines (tenant_id, name, color, position)
    values (v_tenant_id, 'Principal', '#6366F1', 0)
    returning id into v_pipeline_id;

    update pipeline_stages
    set    pipeline_id = v_pipeline_id
    where  tenant_id = v_tenant_id and pipeline_id is null;
  end loop;
end $$;

-- Agora pode ser NOT NULL (todos os existentes já foram migrados)
alter table pipeline_stages
  alter column pipeline_id set not null;

create index if not exists pipeline_stages_pipeline_id
  on pipeline_stages (pipeline_id, position);

-- ── Função: criar pipeline com etapas padrão ─────────────────────────────────

create or replace function create_pipeline_with_defaults(
  p_tenant_id uuid,
  p_name      text,
  p_color     text default '#6366F1'
)
returns uuid language plpgsql as $$
declare
  v_pipeline_id uuid;
  v_position    integer;
begin
  -- Posição após o último pipeline do tenant
  select coalesce(max(position) + 1, 0) into v_position
  from pipelines where tenant_id = p_tenant_id;

  insert into pipelines (tenant_id, name, color, position)
  values (p_tenant_id, p_name, p_color, v_position)
  returning id into v_pipeline_id;

  -- Etapas padrão
  insert into pipeline_stages (tenant_id, pipeline_id, name, color, position, is_final) values
    (p_tenant_id, v_pipeline_id, 'Novo Lead',     '#6366F1', 0, false),
    (p_tenant_id, v_pipeline_id, 'Contato Feito', '#3B82F6', 1, false),
    (p_tenant_id, v_pipeline_id, 'Agendado',      '#F59E0B', 2, false),
    (p_tenant_id, v_pipeline_id, 'Em Negociação', '#EC4899', 3, false),
    (p_tenant_id, v_pipeline_id, 'Fechado',       '#10B981', 4, true ),
    (p_tenant_id, v_pipeline_id, 'Perdido',       '#EF4444', 5, true );

  return v_pipeline_id;
end;
$$;

-- Atualizar create_default_pipeline_stages para compatibilidade retroativa
create or replace function create_default_pipeline_stages(p_tenant_id uuid)
returns void language plpgsql as $$
begin
  perform create_pipeline_with_defaults(p_tenant_id, 'Principal');
end;
$$;
