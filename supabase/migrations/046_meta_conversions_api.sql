-- ═══════════════════════════════════════════════════════════════════════════
-- API de Conversões do Meta — camada de banco
--
-- Problema: campanha de clique-para-WhatsApp só aprende "quem mandou mensagem".
-- Ela não sabe quem virou lead qualificado, quem agendou e quem fechou. Esta
-- migration cria o encanamento pra devolver esse sinal pro Meta a partir do
-- movimento real do card no funil.
--
-- Três eventos, não seis: cada evento precisa de volume próprio pra servir de
-- algo. Nada de "perdido"/"no-show" — o Meta não aprende com evento negativo,
-- o sinal de lead ruim é a AUSÊNCIA do evento.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Credencial da CAPI (por empresa, nunca global) ──────────────────────
-- Fica junto do token de leitura que já existe. São tokens DIFERENTES: o de
-- leitura precisa de `ads_read` na conta de anúncio; este precisa de
-- `ads_management` com o dataset (pixel) atribuído ao usuário do sistema.
alter table meta_ads_credentials
  add column if not exists dataset_id text,
  add column if not exists capi_token text;

comment on column meta_ads_credentials.dataset_id is
  'ID do dataset/pixel do Meta que recebe os eventos. Diferente do ad_account_id.';
comment on column meta_ads_credentials.capi_token is
  'Token da API de Conversões. NUNCA sai do servidor — o frontend só recebe hasCapiToken.';

-- Descoberto ao testar: access_token era NOT NULL, então uma empresa só
-- conseguiria configurar a CAPI se também configurasse o token de LEITURA
-- (ads_read) de campanhas. São coisas independentes — tem cliente que gere o
-- próprio tráfego e só quer devolver o sinal do funil, sem sincronizar
-- campanha nenhuma. Exigir os dois era um bloqueio inventado por acidente.
alter table meta_ads_credentials alter column access_token drop not null;

comment on column meta_ads_credentials.access_token is
  'Token de LEITURA (ads_read) usado pelo sync de campanhas. Independente do capi_token — a empresa pode ter um, outro, ou os dois.';

-- ── 2. Mapa coluna → evento ────────────────────────────────────────────────
-- Por COLUNA, não por empresa: os funis não se parecem entre si (a Studio Gc
-- tem 4 funis por produto, a Green Hub tem 6). Nulo = não dispara nada, que é
-- o padrão pra toda coluna existente.
alter table pipeline_stages
  add column if not exists meta_event text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_stages_meta_event_check'
  ) then
    alter table pipeline_stages
      add constraint pipeline_stages_meta_event_check
      check (meta_event is null or meta_event in ('Lead', 'Schedule', 'Purchase'));
  end if;
end $$;

comment on column pipeline_stages.meta_event is
  'Evento padrão do Meta disparado ao entrar nesta coluna. Nulo = não dispara.';

-- ── 3. Fila de eventos ─────────────────────────────────────────────────────
-- Fila, e não envio direto no clique: se o Meta estiver fora do ar na hora em
-- que a secretária arrasta o card, o evento não pode simplesmente sumir.
create table if not exists meta_conversion_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id)         on delete cascade,
  lead_id     uuid not null references leads(id)           on delete cascade,
  stage_id    uuid          references pipeline_stages(id) on delete set null,
  event_name  text not null,
  event_time  timestamptz not null default now(),
  status      text not null default 'pending'
              check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts    int  not null default 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),

  -- A trava do "uma vez só na vida". Secretária que arrasta pra Fechado, se
  -- arrepende, volta e arrasta de novo geraria 3 Purchase do mesmo cliente —
  -- e o Meta passaria a achar que aquele perfil rende 3x.
  unique (lead_id, event_name)
);

-- Índice da drenagem da fila: o cron varre só o que está pendente.
create index if not exists idx_meta_conv_pendentes
  on meta_conversion_events (status, created_at)
  where status in ('pending', 'failed');

create index if not exists idx_meta_conv_tenant
  on meta_conversion_events (tenant_id, created_at desc);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
alter table meta_conversion_events enable row level security;

-- Só leitura, e só pra gestor/admin: é dado de performance de campanha, não
-- interessa (nem deve aparecer) pro vendedor. Escrita é exclusiva do trigger
-- (SECURITY DEFINER) e da Edge Function (service role) — ninguém insere ou
-- edita evento pelo navegador.
drop policy if exists managers_read_meta_conversions on meta_conversion_events;
create policy managers_read_meta_conversions on meta_conversion_events
  for select using (
    is_tenant_manager(tenant_id)
    or exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  );

-- ── 5. Trigger: card muda de coluna → enfileira ────────────────────────────
create or replace function enqueue_meta_conversion_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event   text;
  v_tem_cred boolean;
  v_tem_match boolean;
begin
  -- Só reage a entrada numa coluna nova. Reordenar card dentro da mesma
  -- coluna não é evento nenhum.
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  select s.meta_event into v_event
  from pipeline_stages s
  where s.id = new.stage_id;

  if v_event is null then
    return new;
  end if;

  -- Empresa sem credencial não enfileira. Sem isso a fila encheria de eventos
  -- das 13 empresas que ainda não configuraram nada, e quando alguém
  -- configurasse levaria um lote retroativo de meses na cara do Meta.
  select (c.dataset_id is not null and c.capi_token is not null)
    into v_tem_cred
  from meta_ads_credentials c
  where c.tenant_id = new.tenant_id;

  if not coalesce(v_tem_cred, false) then
    return new;
  end if;

  -- Sem telefone nem e-mail não há como o Meta casar a pessoa. Evento sem
  -- chave de match é lixo que só suja a taxa de aproveitamento.
  select (l.phone is not null and l.phone <> '')
      or (l.email is not null and l.email <> '')
    into v_tem_match
  from leads l
  where l.id = new.lead_id;

  if not coalesce(v_tem_match, false) then
    return new;
  end if;

  insert into meta_conversion_events (tenant_id, lead_id, stage_id, event_name)
  values (new.tenant_id, new.lead_id, new.stage_id, v_event)
  on conflict (lead_id, event_name) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_meta_conversion on pipeline_cards;
create trigger trg_enqueue_meta_conversion
  after insert or update of stage_id on pipeline_cards
  for each row execute function enqueue_meta_conversion_event();

comment on function enqueue_meta_conversion_event() is
  'Enfileira evento da CAPI quando o card entra numa coluna mapeada. Silencioso de propósito: nunca pode quebrar o arrasto do card no Kanban.';
