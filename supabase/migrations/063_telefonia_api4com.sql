-- Telefonia integrada: clicar em "Ligar" no lead, a chamada acontece pelo
-- número comercial, e o resultado e a gravação voltam sozinhos pro CRM.
--
-- A chamada NÃO ganha tabela própria: vira atividade do tipo 'call', a mesma
-- que o registro manual usa. Assim a taxa de atendimento soma os dois mundos
-- e o histórico do lead fica num lugar só. O que a telefonia acrescenta é
-- duração, gravação e o fato de não depender de alguém lembrar de marcar.

create table if not exists telefonia_credenciais (
  tenant_id      uuid primary key references tenants(id) on delete cascade,
  provedor       text not null default 'api4com',
  token          text,
  -- Segredo da URL do webhook. O provedor não assina a requisição, então a
  -- única forma de saber que é ele é a URL ser impossível de adivinhar.
  webhook_secret text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column telefonia_credenciais.token is
  'Token da API do provedor. NUNCA sai do servidor — o frontend recebe só hasToken.';
comment on column telefonia_credenciais.webhook_secret is
  'Vai na URL que o provedor chama. É o que prova que a chamada veio dele.';

alter table telefonia_credenciais enable row level security;

drop policy if exists admins_gerenciam_telefonia on telefonia_credenciais;
create policy admins_gerenciam_telefonia on telefonia_credenciais
  for all using (
    is_tenant_admin(tenant_id)
    or exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  );

-- Ramal fica no VÍNCULO, não no usuário: a mesma pessoa pode atender por
-- empresas diferentes, com ramais diferentes.
alter table user_memberships add column if not exists ramal text;

comment on column user_memberships.ramal is
  'Ramal do vendedor no provedor de telefonia. Sem ele a pessoa não consegue discar.';

create or replace function meu_ramal(p_tenant_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select m.ramal from user_memberships m
  where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.active;
$$;

revoke all on function meu_ramal(uuid) from public, anon;
grant execute on function meu_ramal(uuid) to authenticated;

-- Registro da chamada. Chamada pela Edge Function do webhook (service_role).
-- O metadata que mandamos no disparo volta aqui, então o lead vem
-- identificado — não é preciso casar por telefone nem por horário.
create or replace function registrar_chamada(
  p_tenant_id uuid, p_lead_id uuid, p_user_id uuid,
  p_resultado text, p_duracao int, p_gravacao text, p_chamada_id text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into lead_activities (tenant_id, lead_id, user_id, type, description, metadata, external_id)
  values (
    p_tenant_id, p_lead_id, p_user_id, 'call',
    case p_resultado
      when 'atendeu'     then 'Ligação atendida — ' || coalesce(p_duracao, 0) || 's'
      when 'nao_atendeu' then 'Ligação não atendida'
      else 'Ligação — ' || coalesce(p_resultado, 'sem resultado')
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'resultado', p_resultado, 'origem', 'api4com', 'duracao', p_duracao,
      'gravacao', p_gravacao, 'chamada_id', p_chamada_id
    )),
    p_chamada_id
  )
  -- O provedor pode reenviar o mesmo evento. external_id evita a chamada
  -- aparecer duas vezes na linha do tempo.
  on conflict do nothing;
end;
$$;

revoke all on function registrar_chamada(uuid, uuid, uuid, text, int, text, text)
  from public, anon, authenticated;

-- Sem índice único o ON CONFLICT acima não tem em que se apoiar.
create unique index if not exists idx_lead_activities_external
  on lead_activities (tenant_id, external_id) where external_id is not null;
