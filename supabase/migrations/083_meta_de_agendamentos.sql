-- Agendamentos como alvo de meta.
--
-- SDR faz contato e agenda; closer faz reunião e fecha. Faltava o meio do
-- funil: "agendamentos". Definição: leads DISTINTOS em que a pessoa registrou
-- uma atividade do tipo `meeting` no período — mesma régua de "contatos", que
-- conta leads distintos tocados. Dez reuniões com o mesmo lead contam um.
--
-- Cada alvo continua opcional. Meta só de contatos + agendamentos (SDR) ou só
-- de vendas (closer) já funcionava: o percentual geral é a média dos alvos
-- DEFINIDOS, e barra sem alvo não aparece.
--
-- Várias funções mudam o formato do que devolvem, e nesses casos CREATE OR
-- REPLACE falha ("cannot change return type"): precisa DROP antes. Grants
-- reaplicados ao fim de cada uma.

alter table public.goals         add column if not exists meetings_target integer;
alter table public.metas_empresa add column if not exists meetings_target integer;

-- ── realizado_no_periodo: ganha agendamentos ────────────────────────────────
drop function if exists public.realizado_no_periodo(uuid, uuid, date, date);
create function public.realizado_no_periodo(
  p_tenant_id uuid, p_user_id uuid, p_from date, p_to date
)
returns table (leads integer, contatos integer, agendamentos integer, vendas integer, faturamento numeric)
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
    (select count(distinct a.lead_id)::int from lead_activities a
      where a.tenant_id = p_tenant_id
        and (p_user_id is null or a.user_id = p_user_id)
        and a.type::text = 'meeting'
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

-- ── percentual_geral: cinco alvos ───────────────────────────────────────────
drop function if exists public.percentual_geral(int, int, int, numeric, int, int, int, numeric);
create function public.percentual_geral(
  p_leads int, p_contatos int, p_agend int, p_vendas int, p_fat numeric,
  p_leads_t int, p_contatos_t int, p_agend_t int, p_vendas_t int, p_fat_t numeric
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
    + (case when p_agend_t    > 0 then least(100, p_agend    * 100.0 / p_agend_t)    else 0 end)
    + (case when p_vendas_t   > 0 then least(100, p_vendas   * 100.0 / p_vendas_t)   else 0 end)
    + (case when p_fat_t      > 0 then least(100, p_fat      * 100.0 / p_fat_t)      else 0 end) as soma,
      (case when p_leads_t > 0 then 1 else 0 end) + (case when p_contatos_t > 0 then 1 else 0 end)
    + (case when p_agend_t > 0 then 1 else 0 end)
    + (case when p_vendas_t > 0 then 1 else 0 end) + (case when p_fat_t > 0 then 1 else 0 end) as cnt
  ) x;
$$;
revoke all on function public.percentual_geral(int,int,int,int,numeric,int,int,int,int,numeric) from public, anon, authenticated;

-- ── get_tenant_goals: devolve meetings_target ───────────────────────────────
drop function if exists public.get_tenant_goals(uuid, boolean);
create function public.get_tenant_goals(p_tenant_id uuid, p_only_active boolean default false)
returns table(id uuid, tenant_id uuid, user_id uuid, period text,
              start_date date, end_date date, leads_target integer,
              calls_target integer, meetings_target integer, deals_target integer, revenue_target numeric,
              created_by uuid, created_at timestamptz,
              user_email text, user_full_name text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;
  return query
  select g.id, g.tenant_id, g.user_id, g.period::text,
         g.start_date, g.end_date,
         g.leads_target, g.calls_target, g.meetings_target, g.deals_target,
         g.revenue_target, g.created_by, g.created_at,
         p.email, p.full_name
  from goals g
  left join profiles p on p.id = g.user_id
  where g.tenant_id = p_tenant_id
    and pode_ver_meta(g.tenant_id, g.user_id, g.created_by)
    and (not p_only_active or g.end_date >= current_date)
  order by g.start_date desc;
end;
$function$;
revoke all on function public.get_tenant_goals(uuid, boolean) from public, anon;
grant execute on function public.get_tenant_goals(uuid, boolean) to authenticated;

-- ── progresso_das_metas ─────────────────────────────────────────────────────
drop function if exists public.progresso_das_metas(uuid, boolean);
create function public.progresso_das_metas(p_tenant_id uuid, p_only_active boolean default false)
returns table (goal_id uuid, leads_actual integer, calls_actual integer, meetings_actual integer,
               deals_actual integer, revenue_actual numeric)
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
    g.id,
    case when g.encerrada_em is not null then (g.resultado_final->>'leads')::int        else r.leads end,
    case when g.encerrada_em is not null then (g.resultado_final->>'contatos')::int     else r.contatos end,
    case when g.encerrada_em is not null then coalesce((g.resultado_final->>'agendamentos')::int, 0) else r.agendamentos end,
    case when g.encerrada_em is not null then (g.resultado_final->>'vendas')::int       else r.vendas end,
    case when g.encerrada_em is not null then (g.resultado_final->>'faturamento')::numeric else r.faturamento end
  from goals g
  cross join lateral realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date) r
  where g.tenant_id = p_tenant_id
    and pode_ver_meta(g.tenant_id, g.user_id, g.created_by)
    and (not p_only_active or g.end_date >= (now() at time zone 'America/Sao_Paulo')::date);
end;
$$;
revoke all on function public.progresso_das_metas(uuid, boolean) from public, anon;
grant execute on function public.progresso_das_metas(uuid, boolean) to authenticated;

-- ── metas_da_empresa ────────────────────────────────────────────────────────
drop function if exists public.metas_da_empresa(uuid, boolean);
create function public.metas_da_empresa(p_tenant_id uuid, p_only_active boolean default false)
returns table (
  id uuid, period text, start_date date, end_date date,
  leads_target int, calls_target int, meetings_target int, deals_target int, revenue_target numeric,
  renovar boolean, encerrada_em timestamptz,
  leads_actual int, calls_actual int, meetings_actual int, deals_actual int, revenue_actual numeric,
  soma_leads_target int, soma_calls_target int, soma_meetings_target int, soma_deals_target int, soma_revenue_target numeric
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
    m.leads_target, m.calls_target, m.meetings_target, m.deals_target, m.revenue_target,
    m.renovar, m.encerrada_em,
    case when m.encerrada_em is not null then (m.resultado_final->>'leads')::int        else r.leads end,
    case when m.encerrada_em is not null then (m.resultado_final->>'contatos')::int     else r.contatos end,
    case when m.encerrada_em is not null then coalesce((m.resultado_final->>'agendamentos')::int, 0) else r.agendamentos end,
    case when m.encerrada_em is not null then (m.resultado_final->>'vendas')::int       else r.vendas end,
    case when m.encerrada_em is not null then (m.resultado_final->>'faturamento')::numeric else r.faturamento end,
    (select coalesce(sum(g.leads_target),0)::int    from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.calls_target),0)::int    from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.meetings_target),0)::int from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.deals_target),0)::int    from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date),
    (select coalesce(sum(g.revenue_target),0)       from goals g where g.tenant_id = m.tenant_id and g.start_date = m.start_date and g.end_date = m.end_date)
  from metas_empresa m
  cross join lateral realizado_no_periodo(m.tenant_id, null, m.start_date, m.end_date) r
  where m.tenant_id = p_tenant_id
    and (not p_only_active or m.end_date >= (now() at time zone 'America/Sao_Paulo')::date)
  order by m.start_date desc;
end;
$$;
revoke all on function public.metas_da_empresa(uuid, boolean) from public, anon;
grant execute on function public.metas_da_empresa(uuid, boolean) to authenticated;

-- ── ranking_do_periodo: coluna de agendamentos ──────────────────────────────
-- Pontuação: agendamento vale 2 (entre contato = 1 e venda = 3).
drop function if exists public.ranking_do_periodo(uuid, date, date);
create function public.ranking_do_periodo(p_tenant_id uuid, p_from date, p_to date)
returns table (user_id uuid, email text, full_name text, leads integer, contatos integer,
               agendamentos integer, vendas integer, faturamento numeric, pontos integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_gestor boolean;
begin
  if not is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;
  v_gestor := is_tenant_manager(p_tenant_id);
  return query
  with pessoas as (
    select um.user_id as uid, p.email, p.full_name
    from user_memberships um
    left join profiles p on p.id = um.user_id
    where um.tenant_id = p_tenant_id and um.active and um.role in ('manager', 'seller')
  )
  select
    ps.uid, coalesce(ps.email, '—'), ps.full_name,
    r.leads, r.contatos, r.agendamentos, r.vendas,
    case when v_gestor then r.faturamento else null end,
    (r.leads + r.contatos + r.agendamentos * 2 + r.vendas * 3)::int
  from pessoas ps
  cross join lateral realizado_no_periodo(p_tenant_id, ps.uid, p_from, p_to) r
  order by 9 desc, 7 desc, 4 desc;
end;
$$;
revoke all on function public.ranking_do_periodo(uuid, date, date) from public, anon;
grant execute on function public.ranking_do_periodo(uuid, date, date) to authenticated;

-- ── detalhe_da_meta: lista de agendamentos ──────────────────────────────────
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
  if not pode_ver_meta(g.tenant_id, g.user_id, g.created_by) then
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
               case when bool_or(coalesce(a.metadata->>'origem','manual') <> 'manual') then 'sistema' else 'manual' end as origem,
               max(a.created_at) as em, count(*)::int as vezes
        from lead_activities a join leads l on l.id = a.lead_id
        where a.tenant_id = g.tenant_id and a.user_id = g.user_id and a.type::text <> 'import'
          and (a.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date
        group by a.lead_id, l.name
      ) x),
    'agendamentos', (
      select coalesce(json_agg(json_build_object('lead_id', x.lead_id, 'nome', x.nome, 'em', x.em, 'vezes', x.vezes) order by x.em desc), '[]'::json)
      from (
        select a.lead_id, l.name as nome, max(a.created_at) as em, count(*)::int as vezes
        from lead_activities a join leads l on l.id = a.lead_id
        where a.tenant_id = g.tenant_id and a.user_id = g.user_id and a.type::text = 'meeting'
          and (a.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date
        group by a.lead_id, l.name
      ) x),
    'vendas', (
      select coalesce(json_agg(json_build_object('id', l.id, 'nome', l.name, 'valor', l.value, 'em', l.updated_at) order by l.updated_at desc), '[]'::json)
      from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date)
  );
end;
$$;
revoke all on function public.detalhe_da_meta(uuid) from public, anon;
grant execute on function public.detalhe_da_meta(uuid) to authenticated;

-- ── Aviso de meta nova: menciona agendamentos ───────────────────────────────
create or replace function public.tg_meta_avisa_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvos text;
  v_periodo text;
begin
  if new.user_id = new.created_by and (tg_op = 'INSERT' or auth.uid() = new.user_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.leads_target, new.calls_target, new.meetings_target, new.deals_target, new.revenue_target)
     is not distinct from (old.leads_target, old.calls_target, old.meetings_target, old.deals_target, old.revenue_target) then
    return new;
  end if;
  v_alvos := concat_ws(' · ',
    case when new.leads_target    > 0 then new.leads_target    || ' leads' end,
    case when new.calls_target    > 0 then new.calls_target    || ' contatos' end,
    case when new.meetings_target > 0 then new.meetings_target || ' agendamentos' end,
    case when new.deals_target    > 0 then new.deals_target    || ' vendas' end,
    case when new.revenue_target  > 0 then reais(new.revenue_target) end);
  v_periodo := to_char(new.start_date, 'DD/MM') || ' a ' || to_char(new.end_date, 'DD/MM');
  perform avisar_meta(new.tenant_id, new.user_id,
    case when tg_op = 'INSERT' then 'Você tem uma meta nova 🎯' else 'Sua meta foi ajustada' end,
    format('%s: %s.', v_periodo, coalesce(nullif(v_alvos, ''), 'sem alvos definidos ainda')));
  return new;
end;
$$;
revoke all on function public.tg_meta_avisa_dono() from public, anon, authenticated;
drop trigger if exists trg_meta_avisa_dono on public.goals;
create trigger trg_meta_avisa_dono
  after insert or update of leads_target, calls_target, meetings_target, deals_target, revenue_target on public.goals
  for each row execute function tg_meta_avisa_dono();

-- ── Rotina diária: passa agendamentos adiante ───────────────────────────────
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
  v_total   integer;
  v_passado integer;
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
  for g in select * from goals where encerrada_em is null and end_date < v_hoje loop
    select * into r from realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date);
    v_pct := percentual_geral(r.leads, r.contatos, r.agendamentos, r.vendas, r.faturamento,
                              g.leads_target, g.calls_target, g.meetings_target, g.deals_target, g.revenue_target);
    update goals
       set encerrada_em = now(),
           resultado_final = jsonb_build_object(
             'leads', r.leads, 'contatos', r.contatos, 'agendamentos', r.agendamentos,
             'vendas', r.vendas, 'faturamento', r.faturamento, 'percentual', v_pct)
     where id = g.id;
    perform avisar_meta(g.tenant_id, g.user_id,
      case when v_pct >= 100 then 'Meta batida! 🎯' else 'Meta encerrada' end,
      format('Período %s a %s fechou em %s%% — %s leads, %s contatos, %s agendamentos, %s vendas, %s.',
        to_char(g.start_date,'DD/MM'), to_char(g.end_date,'DD/MM'), v_pct,
        r.leads, r.contatos, r.agendamentos, r.vendas, reais(r.faturamento)));
    v_avisos := v_avisos + 1;
    if g.renovar and not exists (select 1 from goals x where x.renovada_de = g.id) then
      select * into p from proximo_periodo(g.period, g.end_date);
      insert into goals (tenant_id, user_id, period, start_date, end_date,
                         leads_target, calls_target, meetings_target, deals_target, revenue_target,
                         created_by, renovar, renovada_de)
      values (g.tenant_id, g.user_id, g.period, p.inicio, p.fim,
              g.leads_target, g.calls_target, g.meetings_target, g.deals_target, g.revenue_target,
              g.created_by, true, g.id)
      on conflict (tenant_id, user_id, start_date, end_date) do nothing;
    end if;
  end loop;

  for m in select * from metas_empresa where encerrada_em is null and end_date < v_hoje loop
    select * into r from realizado_no_periodo(m.tenant_id, null, m.start_date, m.end_date);
    v_pct := percentual_geral(r.leads, r.contatos, r.agendamentos, r.vendas, r.faturamento,
                              m.leads_target, m.calls_target, m.meetings_target, m.deals_target, m.revenue_target);
    update metas_empresa
       set encerrada_em = now(),
           resultado_final = jsonb_build_object(
             'leads', r.leads, 'contatos', r.contatos, 'agendamentos', r.agendamentos,
             'vendas', r.vendas, 'faturamento', r.faturamento, 'percentual', v_pct)
     where id = m.id;
    for v_gestor in
      select um.user_id from user_memberships um
      where um.tenant_id = m.tenant_id and um.active and um.role in ('admin','manager')
    loop
      perform avisar_meta(m.tenant_id, v_gestor.user_id,
        case when v_pct >= 100 then 'Empresa bateu a meta! 🏆' else 'Meta da empresa encerrada' end,
        format('Período %s a %s fechou em %s%% — %s leads, %s contatos, %s agendamentos, %s vendas, %s.',
          to_char(m.start_date,'DD/MM'), to_char(m.end_date,'DD/MM'), v_pct,
          r.leads, r.contatos, r.agendamentos, r.vendas, reais(r.faturamento)));
      v_avisos := v_avisos + 1;
    end loop;
    if m.renovar and not exists (select 1 from metas_empresa x where x.renovada_de = m.id) then
      select * into p from proximo_periodo(m.period, m.end_date);
      insert into metas_empresa (tenant_id, period, start_date, end_date,
                                 leads_target, calls_target, meetings_target, deals_target, revenue_target,
                                 created_by, renovar, renovada_de)
      values (m.tenant_id, m.period, p.inicio, p.fim,
              m.leads_target, m.calls_target, m.meetings_target, m.deals_target, m.revenue_target,
              m.created_by, true, m.id)
      on conflict (tenant_id, start_date, end_date) do nothing;
    end if;
  end loop;

  for g in
    select * from goals
    where encerrada_em is null and start_date <= v_hoje and end_date >= v_hoje
      and (leads_target > 0 or calls_target > 0 or meetings_target > 0 or deals_target > 0 or revenue_target > 0)
  loop
    select * into r from realizado_no_periodo(g.tenant_id, g.user_id, g.start_date, g.end_date);
    v_pct     := percentual_geral(r.leads, r.contatos, r.agendamentos, r.vendas, r.faturamento,
                                  g.leads_target, g.calls_target, g.meetings_target, g.deals_target, g.revenue_target);
    v_total   := (g.end_date - g.start_date) + 1;
    v_passado := (v_hoje - g.start_date) + 1;
    v_restam  := g.end_date - v_hoje;
    v_av      := g.avisos;

    v_marco := null;
    for v_m in select unnest(array[25, 50, 75, 100]) loop
      if v_pct >= v_m and not coalesce((v_av->>('m'||v_m))::boolean, false) then
        v_av := v_av || jsonb_build_object('m'||v_m, true);
        v_marco := v_m;
      end if;
    end loop;

    if v_marco = 100 then
      perform avisar_meta(g.tenant_id, g.user_id, 'Meta batida! 🎯',
        format('Você chegou a 100%% da meta de %s a %s. Faltam %s dias — o que vier agora é bônus.',
          to_char(g.start_date,'DD/MM'), to_char(g.end_date,'DD/MM'), v_restam));
      select coalesce(pr.full_name, pr.email) into v_nome from profiles pr where pr.id = g.user_id;
      for v_gestor in
        select um.user_id from user_memberships um
        where um.tenant_id = g.tenant_id and um.active and um.role in ('admin','manager') and um.user_id <> g.user_id
      loop
        perform avisar_meta(g.tenant_id, v_gestor.user_id, 'Meta batida na equipe 🏆',
          format('%s bateu 100%% da meta com %s dias de sobra.', coalesce(v_nome,'Alguém'), v_restam));
      end loop;
      v_avisos := v_avisos + 1;
    elsif v_marco is not null then
      perform avisar_meta(g.tenant_id, g.user_id, format('%s%% da meta', v_marco),
        format('Você passou de %s%% — %s leads, %s contatos, %s agendamentos, %s vendas. Faltam %s dias.',
          v_marco, r.leads, r.contatos, r.agendamentos, r.vendas, v_restam));
      v_avisos := v_avisos + 1;
    end if;

    if v_passado * 2 >= v_total and v_pct < 50 and not coalesce((v_av->>'ritmo')::boolean, false) then
      v_av := v_av || '{"ritmo": true}'::jsonb;
      perform avisar_meta(g.tenant_id, g.user_id, 'Atrás do ritmo ⚠️',
        format('Metade do período já passou e a meta está em %s%%. Faltam %s dias.', v_pct, v_restam));
      v_avisos := v_avisos + 1;
    end if;

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
