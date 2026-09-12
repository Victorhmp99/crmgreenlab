-- Metas, etapas 2 a 5: renovação automática, meta da empresa, avisos e
-- auditoria.
--
-- Etapa 1 (079) deixou UMA régua no banco. Aqui o resto do que o Victor pediu:
--
--   2. Meta que se renova sozinha e congela o resultado ao encerrar.
--   3. Meta da empresa (própria ou soma das individuais) e painel de time.
--   4. "Do que é feito o número": lista dos leads, contatos e vendas que
--      contaram — é a auditoria que substitui bloquear contato manual.
--   5. Avisos pelo sino: marcos (25/50/75/100%), ritmo, risco e fechamento.
--
-- Tudo que é automático roda na `rotina_diaria_de_metas`, no cron das 07:00
-- UTC (04:00 em Brasília), uma vez por dia. Cada aviso sai UMA vez: fica
-- marcado em `avisos` (jsonb) e não repete no dia seguinte.

-- ── Colunas novas em goals ─────────────────────────────────────────────────
alter table public.goals
  add column if not exists renovar         boolean not null default false,
  add column if not exists renovada_de     uuid references public.goals(id) on delete set null,
  add column if not exists encerrada_em    timestamptz,
  add column if not exists resultado_final jsonb,
  add column if not exists avisos          jsonb not null default '{}'::jsonb;

comment on column public.goals.renovar is
  'Ao encerrar, a rotina diária cria a meta do período seguinte com os mesmos alvos.';
comment on column public.goals.resultado_final is
  'Realizado congelado no encerramento. Editar lead antigo não muda o passado.';
comment on column public.goals.avisos is
  'Quais avisos já saíram: {"m25":true,"m50":true,"ritmo":true,"risco":true,...}';

-- ── Meta da empresa ────────────────────────────────────────────────────────
-- Tabela própria em vez de `goals.user_id` nulo: `user_id` é NOT NULL desde a
-- 006 e todo lugar que lista meta assume uma pessoa. Uma linha por período.
create table if not exists public.metas_empresa (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  period          goal_period not null,
  start_date      date not null,
  end_date        date not null,
  leads_target    integer,
  calls_target    integer,
  deals_target    integer,
  revenue_target  numeric(12,2),
  renovar         boolean not null default false,
  renovada_de     uuid references public.metas_empresa(id) on delete set null,
  encerrada_em    timestamptz,
  resultado_final jsonb,
  avisos          jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (tenant_id, start_date, end_date)
);
create index if not exists idx_metas_empresa_tenant on public.metas_empresa (tenant_id, end_date desc);

alter table public.metas_empresa enable row level security;
drop policy if exists membros_veem_meta_da_empresa on public.metas_empresa;
create policy membros_veem_meta_da_empresa on public.metas_empresa
  for select using (is_tenant_member(tenant_id));
drop policy if exists gestores_gerenciam_meta_da_empresa on public.metas_empresa;
create policy gestores_gerenciam_meta_da_empresa on public.metas_empresa
  for all using (is_tenant_manager(tenant_id)) with check (is_tenant_manager(tenant_id));

-- ── Cálculo interno, sem checagem de quem chama ────────────────────────────
-- É chamado por funções que já checaram (progresso_das_metas) e pela rotina
-- do cron, que não tem usuário. Por isso fica fechado pra todo mundo.
create or replace function public.realizado_no_periodo(
  p_tenant_id uuid,
  p_user_id   uuid,      -- null = empresa inteira
  p_from      date,
  p_to        date
)
returns table (leads integer, contatos integer, vendas integer, faturamento numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from leads l
      where l.tenant_id = p_tenant_id
        and (p_user_id is null or l.assigned_to = p_user_id)
        and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to),
    (select count(distinct a.lead_id)::int from lead_activities a
      where a.tenant_id = p_tenant_id
        and (p_user_id is null or a.user_id = p_user_id)
        and a.type::text <> 'import'
        and (a.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to),
    (select count(*)::int from leads l
      where l.tenant_id = p_tenant_id
        and (p_user_id is null or l.assigned_to = p_user_id)
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between p_from and p_to),
    (select coalesce(sum(l.value), 0) from leads l
      where l.tenant_id = p_tenant_id
        and (p_user_id is null or l.assigned_to = p_user_id)
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between p_from and p_to);
$$;
revoke all on function public.realizado_no_periodo(uuid, uuid, date, date) from public, anon, authenticated;

-- Percentual geral: média dos alvos definidos, cada um travado em 100. É a
-- mesma conta que o card faz na tela — precisa ser, porque o aviso "50%" tem
-- que bater com o "50%" que a pessoa vê.
create or replace function public.percentual_geral(
  p_leads int, p_contatos int, p_vendas int, p_fat numeric,
  p_leads_t int, p_contatos_t int, p_vendas_t int, p_fat_t numeric
)
returns integer
language sql
immutable
as $$
  select case when cnt = 0 then 0 else round(soma / cnt)::int end
  from (
    select
      (case when p_leads_t    > 0 then least(100, p_leads    * 100.0 / p_leads_t)    else 0 end)
    + (case when p_contatos_t > 0 then least(100, p_contatos * 100.0 / p_contatos_t) else 0 end)
    + (case when p_vendas_t   > 0 then least(100, p_vendas   * 100.0 / p_vendas_t)   else 0 end)
    + (case when p_fat_t      > 0 then least(100, p_fat      * 100.0 / p_fat_t)      else 0 end) as soma,
      (case when p_leads_t > 0 then 1 else 0 end) + (case when p_contatos_t > 0 then 1 else 0 end)
    + (case when p_vendas_t > 0 then 1 else 0 end) + (case when p_fat_t > 0 then 1 else 0 end) as cnt
  ) x;
$$;
revoke all on function public.percentual_geral(int,int,int,numeric,int,int,int,numeric) from public, anon, authenticated;

-- ── progresso_das_metas: congelado quando encerrada ────────────────────────
-- Meta encerrada devolve o `resultado_final`, não o cálculo vivo. Sem isso,
-- editar um lead de dois meses atrás mudaria o histórico.
create or replace function public.progresso_das_metas(
  p_tenant_id    uuid,
  p_only_active  boolean default false
)
returns table (
  goal_id         uuid,
  leads_actual    integer,
  calls_actual    integer,
  deals_actual    integer,
  revenue_actual  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ve_tudo boolean;
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;
  v_ve_tudo := is_tenant_manager(p_tenant_id);

  return query
  select
    g.id,
    case when g.encerrada_em is not null then (g.resultado_final->>'leads')::int       else r.leads end,
    case when g.encerrada_em is not null then (g.resultado_final->>'contatos')::int    else r.contatos end,
    case when g.encerrada_em is not null then (g.resultado_final->>'vendas')::int      else r.vendas end,
    case when g.encerrada_em is not null then (g.resultado_final->>'faturamento')::numeric else r.faturamento end
  from goals g
  cross join lateral realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date) r
  where g.tenant_id = p_tenant_id
    and (v_ve_tudo or g.user_id = auth.uid())
    and (not p_only_active or g.end_date >= (now() at time zone 'America/Sao_Paulo')::date);
end;
$$;
revoke all on function public.progresso_das_metas(uuid, boolean) from public, anon;
grant execute on function public.progresso_das_metas(uuid, boolean) to authenticated;

-- ── Meta da empresa com progresso ──────────────────────────────────────────
create or replace function public.metas_da_empresa(p_tenant_id uuid, p_only_active boolean default false)
returns table (
  id uuid, period text, start_date date, end_date date,
  leads_target int, calls_target int, deals_target int, revenue_target numeric,
  renovar boolean, encerrada_em timestamptz,
  leads_actual int, calls_actual int, deals_actual int, revenue_actual numeric,
  -- soma dos alvos individuais do mesmo período: referência quando a empresa
  -- não definiu número próprio, e comparação quando definiu
  soma_leads_target int, soma_calls_target int, soma_deals_target int, soma_revenue_target numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    m.id, m.period::text, m.start_date, m.end_date,
    m.leads_target, m.calls_target, m.deals_target, m.revenue_target,
    m.renovar, m.encerrada_em,
    case when m.encerrada_em is not null then (m.resultado_final->>'leads')::int       else r.leads end,
    case when m.encerrada_em is not null then (m.resultado_final->>'contatos')::int    else r.contatos end,
    case when m.encerrada_em is not null then (m.resultado_final->>'vendas')::int      else r.vendas end,
    case when m.encerrada_em is not null then (m.resultado_final->>'faturamento')::numeric else r.faturamento end,
    (select coalesce(sum(g.leads_target),0)::int   from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.calls_target),0)::int   from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.deals_target),0)::int   from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.revenue_target),0)      from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date)
  from metas_empresa m
  cross join lateral realizado_no_periodo(m.tenant_id, null, m.start_date, m.end_date) r
  where m.tenant_id = p_tenant_id
    and (not p_only_active or m.end_date >= (now() at time zone 'America/Sao_Paulo')::date)
  order by m.start_date desc;
end;
$$;
revoke all on function public.metas_da_empresa(uuid, boolean) from public, anon;
grant execute on function public.metas_da_empresa(uuid, boolean) to authenticated;

-- ── Auditoria: do que é feito o número ─────────────────────────────────────
-- Quem vê: o dono da meta e o gestor. Cada contato diz se veio do sistema
-- (telefonia, CRC) ou foi registrado na mão — é assim que "dez contatos e
-- nenhum agendamento" fica visível sem bloquear ninguém.
create or replace function public.detalhe_da_meta(p_goal_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g goals%rowtype;
begin
  select * into g from goals where id = p_goal_id;
  if not found then raise exception 'Meta não encontrada'; end if;
  if not (g.user_id = auth.uid() or is_tenant_manager(g.tenant_id)) then
    raise exception 'Unauthorized';
  end if;

  return json_build_object(
    'leads', (
      select coalesce(json_agg(json_build_object('id', l.id, 'nome', l.name, 'em', l.created_at) order by l.created_at desc), '[]'::json)
      from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and (l.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date),
    'contatos', (
      select coalesce(json_agg(json_build_object(
                'lead_id', x.lead_id, 'nome', x.nome, 'tipo', x.tipo, 'origem', x.origem, 'em', x.em, 'vezes', x.vezes)
              order by x.em desc), '[]'::json)
      from (
        select a.lead_id, l.name as nome,
               (array_agg(a.type::text order by a.created_at desc))[1] as tipo,
               -- 'sistema' quando ALGUM registro do lead veio de telefonia/CRC;
               -- 'manual' quando todos foram digitados
               case when bool_or(coalesce(a.metadata->>'origem','manual') <> 'manual') then 'sistema' else 'manual' end as origem,
               max(a.created_at) as em,
               count(*)::int as vezes
        from lead_activities a
        join leads l on l.id = a.lead_id
        where a.tenant_id = g.tenant_id and a.user_id = g.user_id
          and a.type::text <> 'import'
          and (a.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date
        group by a.lead_id, l.name
      ) x),
    'vendas', (
      select coalesce(json_agg(json_build_object('id', l.id, 'nome', l.name, 'valor', l.value, 'em', l.updated_at) order by l.updated_at desc), '[]'::json)
      from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date)
  );
end;
$$;
revoke all on function public.detalhe_da_meta(uuid) from public, anon;
grant execute on function public.detalhe_da_meta(uuid) to authenticated;

-- ── Período seguinte ───────────────────────────────────────────────────────
create or replace function public.proximo_periodo(p_period goal_period, p_end date)
returns table (inicio date, fim date)
language sql
immutable
as $$
  select (p_end + 1)::date,
         case p_period
           when 'daily'     then (p_end + 1)::date
           when 'weekly'    then (p_end + 7)::date
           when 'monthly'   then ((p_end + 1) + interval '1 month' - interval '1 day')::date
           when 'quarterly' then ((p_end + 1) + interval '3 months' - interval '1 day')::date
         end;
$$;
revoke all on function public.proximo_periodo(goal_period, date) from public, anon, authenticated;

-- ── Reais em formato brasileiro ────────────────────────────────────────────
-- to_char com G/D obedece o locale do servidor (americano): "5,000.00".
-- Formata na mão: milhar com ponto, decimal com vírgula.
create or replace function public.reais(p numeric)
returns text
language sql
immutable
as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(p,0), 'FM999G999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;
revoke all on function public.reais(numeric) from public, anon, authenticated;

-- ── Aviso pelo sino, uma vez só ────────────────────────────────────────────
create or replace function public.avisar_meta(
  p_tenant_id uuid, p_recipient uuid, p_title text, p_body text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (tenant_id, recipient_id, created_by, title, body, link)
  values (p_tenant_id, p_recipient, null, p_title, p_body, '/goals');
$$;
revoke all on function public.avisar_meta(uuid, uuid, text, text) from public, anon, authenticated;

-- ── A rotina diária ────────────────────────────────────────────────────────
create or replace function public.rotina_diaria_de_metas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  g         record;
  m         record;
  r         record;
  v_pct     integer;
  v_total   integer;   -- dias do período
  v_passado integer;   -- dias já passados (inclui hoje)
  v_restam  integer;
  v_av      jsonb;
  v_marco   integer;
  v_m       integer;
  v_proj    numeric;
  v_nome    text;
  v_gestor  record;
  v_avisos  integer := 0;
  p         record;
begin
  -- ── 1. Encerrar metas vencidas (congela + fecha + renova) ────────────────
  for g in
    select * from goals where encerrada_em is null and end_date < v_hoje
  loop
    select * into r from realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date);
    v_pct := percentual_geral(r.leads, r.contatos, r.vendas, r.faturamento,
                              g.leads_target, g.calls_target, g.deals_target, g.revenue_target);

    update goals
       set encerrada_em = now(),
           resultado_final = jsonb_build_object(
             'leads', r.leads, 'contatos', r.contatos, 'vendas', r.vendas,
             'faturamento', r.faturamento, 'percentual', v_pct)
     where id = g.id;

    perform avisar_meta(g.tenant_id, g.user_id,
      case when v_pct >= 100 then 'Meta batida! 🎯' else 'Meta encerrada' end,
      format('Período %s a %s fechou em %s%% — %s leads, %s contatos, %s vendas, %s.',
        to_char(g.start_date,'DD/MM'), to_char(g.end_date,'DD/MM'), v_pct,
        r.leads, r.contatos, r.vendas, reais(r.faturamento)));
    v_avisos := v_avisos + 1;

    -- Renova: só se pediu e ainda não existe a próxima (idempotente — a rotina
    -- pode rodar duas vezes no mesmo dia sem duplicar).
    if g.renovar and not exists (select 1 from goals x where x.renovada_de = g.id) then
      select * into p from proximo_periodo(g.period, g.end_date);
      insert into goals (tenant_id, user_id, period, start_date, end_date,
                         leads_target, calls_target, deals_target, revenue_target,
                         created_by, renovar, renovada_de)
      values (g.tenant_id, g.user_id, g.period, p.inicio, p.fim,
              g.leads_target, g.calls_target, g.deals_target, g.revenue_target,
              g.created_by, true, g.id);
    end if;
  end loop;

  -- Meta da empresa: mesmo ciclo, aviso vai pros gestores
  for m in
    select * from metas_empresa where encerrada_em is null and end_date < v_hoje
  loop
    select * into r from realizado_no_periodo(m.tenant_id, null, m.start_date, m.end_date);
    v_pct := percentual_geral(r.leads, r.contatos, r.vendas, r.faturamento,
                              m.leads_target, m.calls_target, m.deals_target, m.revenue_target);
    update metas_empresa
       set encerrada_em = now(),
           resultado_final = jsonb_build_object(
             'leads', r.leads, 'contatos', r.contatos, 'vendas', r.vendas,
             'faturamento', r.faturamento, 'percentual', v_pct)
     where id = m.id;

    for v_gestor in
      select um.user_id from user_memberships um
      where um.tenant_id = m.tenant_id and um.active and um.role in ('admin','manager')
    loop
      perform avisar_meta(m.tenant_id, v_gestor.user_id,
        case when v_pct >= 100 then 'Empresa bateu a meta! 🏆' else 'Meta da empresa encerrada' end,
        format('Período %s a %s fechou em %s%% — %s leads, %s contatos, %s vendas, %s.',
          to_char(m.start_date,'DD/MM'), to_char(m.end_date,'DD/MM'), v_pct,
          r.leads, r.contatos, r.vendas, reais(r.faturamento)));
      v_avisos := v_avisos + 1;
    end loop;

    if m.renovar and not exists (select 1 from metas_empresa x where x.renovada_de = m.id) then
      select * into p from proximo_periodo(m.period, m.end_date);
      insert into metas_empresa (tenant_id, period, start_date, end_date,
                                 leads_target, calls_target, deals_target, revenue_target,
                                 created_by, renovar, renovada_de)
      values (m.tenant_id, m.period, p.inicio, p.fim,
              m.leads_target, m.calls_target, m.deals_target, m.revenue_target,
              m.created_by, true, m.id)
      on conflict (tenant_id, start_date, end_date) do nothing;
    end if;
  end loop;

  -- ── 2. Avisos das metas em andamento ─────────────────────────────────────
  for g in
    select * from goals
    where encerrada_em is null and start_date <= v_hoje and end_date >= v_hoje
      and (leads_target > 0 or calls_target > 0 or deals_target > 0 or revenue_target > 0)
  loop
    select * into r from realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date);
    v_pct     := percentual_geral(r.leads, r.contatos, r.vendas, r.faturamento,
                                  g.leads_target, g.calls_target, g.deals_target, g.revenue_target);
    v_total   := (g.end_date - g.start_date) + 1;
    v_passado := (v_hoje - g.start_date) + 1;
    v_restam  := g.end_date - v_hoje;
    v_av      := g.avisos;

    -- Marcos: 25, 50, 75, 100. Sai UM aviso, do maior marco alcançado que
    -- ainda não saiu; os menores ficam marcados em silêncio. Sem isso, uma meta
    -- que já está em 80% quando a rotina roda pela primeira vez recebia três
    -- avisos de uma vez (25, 50 e 75).
    v_marco := null;
    for v_m in select unnest(array[25, 50, 75, 100]) loop
      if v_pct >= v_m and not coalesce((v_av->>('m'||v_m))::boolean, false) then
        v_av    := v_av || jsonb_build_object('m'||v_m, true);
        v_marco := v_m;
      end if;
    end loop;

    if v_marco = 100 then
      perform avisar_meta(g.tenant_id, g.user_id, 'Meta batida! 🎯',
        format('Você chegou a 100%% da meta de %s a %s. Faltam %s dias — o que vier agora é bônus.',
          to_char(g.start_date,'DD/MM'), to_char(g.end_date,'DD/MM'), v_restam));
      -- gestor fica sabendo quem bateu
      select coalesce(pr.full_name, pr.email) into v_nome from profiles pr where pr.id = g.user_id;
      for v_gestor in
        select um.user_id from user_memberships um
        where um.tenant_id = g.tenant_id and um.active and um.role in ('admin','manager')
          and um.user_id <> g.user_id
      loop
        perform avisar_meta(g.tenant_id, v_gestor.user_id, 'Meta batida na equipe 🏆',
          format('%s bateu 100%% da meta com %s dias de sobra.', coalesce(v_nome,'Alguém'), v_restam));
      end loop;
      v_avisos := v_avisos + 1;
    elsif v_marco is not null then
      perform avisar_meta(g.tenant_id, g.user_id, format('%s%% da meta', v_marco),
        format('Você passou de %s%% — %s leads, %s contatos, %s vendas. Faltam %s dias.',
          v_marco, r.leads, r.contatos, r.vendas, v_restam));
      v_avisos := v_avisos + 1;
    end if;

    -- Ritmo: passou metade do período e não chegou à metade da meta.
    if v_passado * 2 >= v_total and v_pct < 50 and not coalesce((v_av->>'ritmo')::boolean, false) then
      v_av := v_av || '{"ritmo": true}'::jsonb;
      perform avisar_meta(g.tenant_id, g.user_id, 'Atrás do ritmo ⚠️',
        format('Metade do período já passou e a meta está em %s%%. Faltam %s dias.', v_pct, v_restam));
      v_avisos := v_avisos + 1;
    end if;

    -- Risco: reta final (últimos 5 dias, ou 20%% do período, o que for maior)
    -- e a projeção no ritmo atual não chega a 100.
    if v_restam <= greatest(5, ceil(v_total * 0.2)) and v_pct < 100
       and not coalesce((v_av->>'risco')::boolean, false) then
      v_proj := v_pct + (v_pct::numeric / greatest(v_passado, 1)) * v_restam;
      if v_proj < 100 then
        v_av := v_av || '{"risco": true}'::jsonb;
        perform avisar_meta(g.tenant_id, g.user_id, 'Pouca chance de bater 🚨',
          format('Faltam %s dias e a meta está em %s%%. No ritmo atual termina perto de %s%%.',
            v_restam, v_pct, least(99, round(v_proj))));
        v_avisos := v_avisos + 1;
      end if;
    end if;

    if v_av <> g.avisos then
      update goals set avisos = v_av where id = g.id;
    end if;
  end loop;

  return v_avisos;
end;
$$;

revoke all on function public.rotina_diaria_de_metas() from public, anon, authenticated;
grant execute on function public.rotina_diaria_de_metas() to service_role;

-- 07:00 UTC = 04:00 em Brasília: depois da virada do dia, antes do expediente.
select cron.unschedule('metas-diario') where exists (select 1 from cron.job where jobname = 'metas-diario');
select cron.schedule('metas-diario', '0 7 * * *', 'select rotina_diaria_de_metas()');
