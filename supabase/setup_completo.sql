-- ================================================================
-- GREEN HUB CRM — Setup Completo do Banco de Dados
-- Cole tudo isso no SQL Editor do Supabase e execute
-- ================================================================


-- ================================================================
-- PARTE 1: TIPOS ENUM
-- ================================================================

create type user_role         as enum ('admin', 'manager', 'seller');
create type lead_status       as enum ('active', 'converted', 'lost', 'archived');
create type lead_source       as enum ('manual', 'import', 'meta_ads', 'google', 'referral', 'other');
create type activity_type     as enum ('call', 'whatsapp', 'email', 'meeting', 'note', 'stage_change', 'import');
create type goal_period       as enum ('daily', 'weekly', 'monthly', 'quarterly');
create type record_type       as enum ('revenue', 'expense');
create type automation_trigger as enum ('stage_change', 'activity_created', 'lead_created', 'goal_reached');
create type automation_action  as enum ('move_stage', 'notify_user', 'assign_lead', 'add_tag');


-- ================================================================
-- PARTE 2: TABELAS (sem políticas ainda)
-- ================================================================

-- Tenants
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
  primary_color   text not null default '#00e676',
  secondary_color text not null default '#00c853',
  custom_domain   text unique,
  updated_at      timestamptz not null default now()
);

-- User memberships
create table if not exists user_memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  role       user_role not null default 'seller',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, tenant_id)
);
create index on user_memberships (user_id, tenant_id);

-- Profiles
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

-- Tenant invites
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

-- Leads
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

-- Pipeline stages
create table if not exists pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366F1',
  position    integer not null,
  is_final    boolean not null default false,
  pipeline_id uuid,   -- FK adicionada depois (abaixo)
  created_at  timestamptz not null default now()
);
create index on pipeline_stages (tenant_id, position);

-- Pipelines múltiplos
create table if not exists pipelines (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#00e676',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index on pipelines (tenant_id, position);

-- Agora adiciona FK de pipeline_stages → pipelines
alter table pipeline_stages
  add constraint pipeline_stages_pipeline_id_fkey
  foreign key (pipeline_id) references pipelines(id) on delete cascade;

-- Pipeline cards
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

-- Lead activities
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

-- Goals
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

-- Financial records
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

-- Campaigns
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

-- Meta Ads credentials
create table if not exists meta_ads_credentials (
  tenant_id      uuid primary key references tenants(id) on delete cascade,
  app_id         text not null,
  access_token   text not null,
  ad_account_id  text not null,
  synced_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Automations
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


-- ================================================================
-- PARTE 3: ROW LEVEL SECURITY (ativa em todas as tabelas)
-- ================================================================

alter table tenants             enable row level security;
alter table tenant_settings     enable row level security;
alter table user_memberships    enable row level security;
alter table profiles            enable row level security;
alter table tenant_invites      enable row level security;
alter table leads               enable row level security;
alter table pipeline_stages     enable row level security;
alter table pipelines           enable row level security;
alter table pipeline_cards      enable row level security;
alter table lead_activities     enable row level security;
alter table goals               enable row level security;
alter table financial_records   enable row level security;
alter table campaigns           enable row level security;
alter table meta_ads_credentials enable row level security;
alter table automations         enable row level security;


-- ================================================================
-- PARTE 4: POLÍTICAS RLS
-- (todas as tabelas já existem aqui, sem erro de referência)
-- ================================================================

-- Tenants
create policy "members_see_own_tenant" on tenants
  for select using (
    id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "authenticated_users_can_create_tenant" on tenants
  for insert to authenticated with check (true);

-- Tenant settings
create policy "members_see_tenant_settings" on tenant_settings
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "admins_update_tenant_settings" on tenant_settings
  for update using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role = 'admin' and active = true)
  );

create policy "admin_can_create_tenant_settings" on tenant_settings
  for insert to authenticated with check (
    exists (select 1 from user_memberships where user_id = auth.uid() and tenant_id = tenant_settings.tenant_id and role = 'admin' and active = true)
  );

-- User memberships
create policy "users_see_own_memberships" on user_memberships
  for select using (user_id = auth.uid());

create policy "admins_manage_memberships" on user_memberships
  for all using (
    tenant_id in (select tenant_id from user_memberships m where m.user_id = auth.uid() and m.role = 'admin' and m.active = true)
  );

create policy "users_can_create_own_membership" on user_memberships
  for insert to authenticated with check (user_id = auth.uid());

-- Profiles
create policy "tenant_members_see_profiles" on profiles
  for select using (
    id in (
      select user_id from user_memberships
      where tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
    )
  );

create policy "users_update_own_profile" on profiles
  for update using (id = auth.uid());

-- Tenant invites
create policy "admins_manage_invites" on tenant_invites
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role = 'admin' and active = true)
  );

create policy "anyone_read_invite_by_token" on tenant_invites
  for select using (true);

-- Leads
create policy "tenant_members_see_leads" on leads
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "tenant_members_create_leads" on leads
  for insert with check (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "tenant_members_update_leads" on leads
  for update using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "managers_delete_leads" on leads
  for delete using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

-- Pipeline stages
create policy "tenant_members_see_stages" on pipeline_stages
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "admins_manage_stages" on pipeline_stages
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

-- Pipelines
create policy "tenant_members_see_pipelines" on pipelines
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "managers_manage_pipelines" on pipelines
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

-- Pipeline cards
create policy "tenant_members_see_cards" on pipeline_cards
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "tenant_members_manage_cards" on pipeline_cards
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

-- Lead activities
create policy "tenant_members_see_activities" on lead_activities
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "tenant_members_create_activities" on lead_activities
  for insert with check (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

-- Goals
create policy "members_see_goals" on goals
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
    and (
      user_id = auth.uid()
      or exists (select 1 from user_memberships where user_id = auth.uid() and tenant_id = goals.tenant_id and role in ('admin','manager') and active = true)
    )
  );

create policy "managers_manage_goals" on goals
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

-- Financial records
create policy "managers_see_financial" on financial_records
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

create policy "managers_manage_financial" on financial_records
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

-- Campaigns
create policy "managers_see_campaigns" on campaigns
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );

create policy "admins_manage_campaigns" on campaigns
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role = 'admin' and active = true)
  );

-- Meta Ads credentials
create policy "admins_manage_meta_credentials" on meta_ads_credentials
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role = 'admin' and active = true)
  );

-- Automations
create policy "members_see_automations" on automations
  for select using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and active = true)
  );

create policy "admins_manage_automations" on automations
  for all using (
    tenant_id in (select tenant_id from user_memberships where user_id = auth.uid() and role in ('admin','manager') and active = true)
  );


-- ================================================================
-- PARTE 5: FUNÇÕES E TRIGGERS
-- ================================================================

-- Trigger: atualiza updated_at nos leads
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

-- Trigger: cria profile automaticamente ao registrar usuário
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

-- RPC: aceitar convite por token
create or replace function accept_invite(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite  tenant_invites;
  v_user_id uuid := auth.uid();
begin
  select * into v_invite
  from tenant_invites
  where token = p_token and accepted_at is null and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'Convite inválido ou expirado.');
  end if;

  insert into user_memberships (user_id, tenant_id, role)
  values (v_user_id, v_invite.tenant_id, v_invite.role)
  on conflict (user_id, tenant_id) do update set role = excluded.role, active = true;

  update tenant_invites set accepted_at = now() where id = v_invite.id;

  return jsonb_build_object('success', true, 'tenant_id', v_invite.tenant_id);
end;
$$;

-- Função: criar pipeline com etapas padrão
create or replace function create_pipeline_with_defaults(
  p_tenant_id uuid,
  p_name      text,
  p_color     text default '#00e676'
)
returns uuid language plpgsql as $$
declare
  v_pipeline_id uuid;
  v_position    integer;
begin
  select coalesce(max(position) + 1, 0) into v_position
  from pipelines where tenant_id = p_tenant_id;

  insert into pipelines (tenant_id, name, color, position)
  values (p_tenant_id, p_name, p_color, v_position)
  returning id into v_pipeline_id;

  insert into pipeline_stages (tenant_id, pipeline_id, name, color, position, is_final) values
    (p_tenant_id, v_pipeline_id, 'Novo Lead',     '#6366F1', 0, false),
    (p_tenant_id, v_pipeline_id, 'Contato Feito', '#3B82F6', 1, false),
    (p_tenant_id, v_pipeline_id, 'Agendado',      '#F59E0B', 2, false),
    (p_tenant_id, v_pipeline_id, 'Em Negociação', '#EC4899', 3, false),
    (p_tenant_id, v_pipeline_id, 'Fechado',       '#10B981', 4, true),
    (p_tenant_id, v_pipeline_id, 'Perdido',       '#EF4444', 5, true);

  return v_pipeline_id;
end;
$$;
