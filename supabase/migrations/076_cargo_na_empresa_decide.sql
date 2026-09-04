-- Cargo DENTRO da empresa decide o que a pessoa ve — ser super admin da
-- plataforma nao vale como cargo.
--
-- Eu tinha escrito as regras como "gestor OU super admin". Parecia razoavel e
-- estava errado: sao duas coisas diferentes. A mesma conta pode ser vendedora
-- numa empresa, gestora em outra e admin numa terceira; e ser super admin da
-- plataforma nao muda nada disso dentro de cada uma.
--
-- Na pratica: uma conta de plataforma que tambem era VENDEDORA de um cliente
-- via o faturamento, a receita e o ranking de vendas daquele cliente. E o
-- CLAUDE.md ja dizia que o super admin administra (empresas, usuarios, papeis)
-- mas nao le dado de cliente — a regra existia, o codigo e que nao seguia.
--
-- Passa a valer em `get_pipeline_financial_metrics`, `get_seller_financial_metrics`
-- e `get_tenant_goals`. A tela acompanha (Dashboard, aba de contrato do lead e
-- o campo de responsavel), mas quem recusa e o banco.
--
-- Conferido com a conta real do Victor, que e vendedora na Apresentacao,
-- gestora na "teste 5" e admin na "teste1": recebeu escopo "meus" na primeira
-- (com o ranking recusado) e "empresa" nas outras duas.

-- ── 1. Ranking por vendedor ────────────────────────────────────────────────
create or replace function public.get_seller_financial_metrics(
  p_tenant_id uuid, p_from date default null, p_to date default null)
returns table(user_id uuid, email text, full_name text, total_leads integer,
              won_count integer, lost_count integer, revenue numeric,
              forecast numeric, loss numeric, avg_ticket numeric, conv_rate integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  -- Sem o "ou super admin": cargo na empresa e o que decide.
  IF NOT is_tenant_manager(p_tenant_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  RETURN QUERY
  WITH members AS (
    SELECT m.user_id AS uid, p.email, p.full_name
    FROM user_memberships m
    LEFT JOIN profiles p ON p.id = m.user_id
    WHERE m.tenant_id = p_tenant_id
      AND m.active = true
      AND m.role IN ('manager', 'seller')
  ),
  lead_class AS (
    SELECT l.id, l.assigned_to AS uid, l.value,
      CASE
        WHEN l.status = 'converted' OR EXISTS (SELECT 1 FROM pipeline_cards pc JOIN pipeline_stages ps ON ps.id = pc.stage_id WHERE pc.lead_id = l.id AND ps.stage_type = 'won') THEN 'won'
        WHEN l.status = 'lost' OR EXISTS (SELECT 1 FROM pipeline_cards pc JOIN pipeline_stages ps ON ps.id = pc.stage_id WHERE pc.lead_id = l.id AND ps.stage_type = 'lost') THEN 'lost'
        WHEN EXISTS (SELECT 1 FROM pipeline_cards pc JOIN pipeline_stages ps ON ps.id = pc.stage_id WHERE pc.lead_id = l.id AND ps.stage_type = 'in_progress') THEN 'in_progress'
        ELSE 'none'
      END AS classification,
      (p_from IS NULL OR (l.updated_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_from)
        AND (p_to IS NULL OR (l.updated_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_to) AS in_period
    FROM leads l
    WHERE l.tenant_id = p_tenant_id AND l.assigned_to IS NOT NULL
  ),
  lead_counts AS (SELECT uid, COUNT(*) AS cnt FROM lead_class GROUP BY uid)
  SELECT
    m.uid AS user_id,
    COALESCE(m.email, '—') AS email,
    m.full_name AS full_name,
    COALESCE(lc.cnt, 0)::int AS total_leads,
    COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won'  AND lcl.in_period)::int AS won_count,
    COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'lost' AND lcl.in_period)::int AS lost_count,
    COALESCE(SUM(DISTINCT lcl.value) FILTER (WHERE lcl.classification = 'won'  AND lcl.in_period), 0) AS revenue,
    COALESCE(SUM(DISTINCT lcl.value) FILTER (WHERE lcl.classification = 'in_progress'), 0) AS forecast,
    COALESCE(SUM(DISTINCT lcl.value) FILTER (WHERE lcl.classification = 'lost' AND lcl.in_period), 0) AS loss,
    CASE WHEN COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period) > 0
      THEN COALESCE(SUM(DISTINCT lcl.value) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period), 0) / COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period)
      ELSE 0 END AS avg_ticket,
    CASE WHEN (COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period) + COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'lost' AND lcl.in_period)) > 0
      THEN ROUND((COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period)::numeric / (COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'won' AND lcl.in_period) + COUNT(DISTINCT lcl.id) FILTER (WHERE lcl.classification = 'lost' AND lcl.in_period))) * 100)::int
      ELSE 0 END AS conv_rate
  FROM members m
  LEFT JOIN lead_counts lc ON lc.uid = m.uid
  LEFT JOIN lead_class lcl ON lcl.uid = m.uid
  GROUP BY m.uid, m.email, m.full_name, lc.cnt
  ORDER BY revenue DESC, total_leads DESC;
END;
$function$;

revoke all on function public.get_seller_financial_metrics(uuid, date, date) from public, anon;
grant execute on function public.get_seller_financial_metrics(uuid, date, date) to authenticated;

-- ── 2. Metas ───────────────────────────────────────────────────────────────
create or replace function public.get_tenant_goals(
  p_tenant_id uuid, p_only_active boolean default false)
returns table(id uuid, tenant_id uuid, user_id uuid, period text,
              start_date date, end_date date, leads_target integer,
              calls_target integer, deals_target integer, revenue_target numeric,
              created_by uuid, created_at timestamptz,
              user_email text, user_full_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ve_tudo boolean;
begin
  if not exists (
    select 1 from user_memberships um
    where um.user_id = auth.uid() and um.tenant_id = p_tenant_id and um.active = true
  ) and not exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  then raise exception 'Unauthorized'; end if;

  v_ve_tudo := is_tenant_manager(p_tenant_id);

  return query
  select g.id, g.tenant_id, g.user_id, g.period::text,
         g.start_date, g.end_date,
         g.leads_target, g.calls_target, g.deals_target,
         g.revenue_target, g.created_by, g.created_at,
         p.email, p.full_name
  from goals g
  left join profiles p on p.id = g.user_id
  where g.tenant_id = p_tenant_id
    and (v_ve_tudo or g.user_id = auth.uid())
    and (not p_only_active or g.end_date >= current_date)
  order by g.start_date desc;
end;
$function$;

revoke all on function public.get_tenant_goals(uuid, boolean) from public, anon;
grant execute on function public.get_tenant_goals(uuid, boolean) to authenticated;

-- ── 3. Dashboard ───────────────────────────────────────────────────────────
create or replace function public.get_pipeline_financial_metrics(
  p_tenant_id uuid,
  p_from date default null,
  p_to date default null,
  p_escopo text default null       -- 'meus' | 'empresa' (null = padrão do cargo)
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_faturamento numeric := 0; v_forecast numeric := 0; v_loss_value numeric := 0;
  v_receita     numeric := 0;
  v_won_count int := 0; v_lost_count int := 0; v_in_progress_count int := 0;
  v_active_count int := 0;
  v_total int := 0; v_avg numeric := 0; v_rate int := 0;
  v_gestor boolean;
  v_so_meus boolean;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from user_memberships um where um.user_id = auth.uid() and um.tenant_id = p_tenant_id and um.active = true)
     and not exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  then raise exception 'Unauthorized'; end if;

  v_gestor := is_tenant_manager(p_tenant_id);

  -- Vendedor é sempre 'meus', peça ele o que pedir. O gestor escolhe, e sem
  -- escolha vê a empresa, que é o padrão de sempre.
  v_so_meus := case
    when not v_gestor then true
    else coalesce(p_escopo, 'empresa') = 'meus'
  end;

  with lead_class as (
    select
      l.id,
      l.value,
      case
        when l.status = 'converted' then 'won'
        when exists (
          select 1 from pipeline_cards pc
          join pipeline_stages ps on ps.id = pc.stage_id
          where pc.lead_id = l.id and ps.stage_type = 'won'
        ) then 'won'
        when l.status = 'lost' then 'lost'
        when exists (
          select 1 from pipeline_cards pc
          join pipeline_stages ps on ps.id = pc.stage_id
          where pc.lead_id = l.id and ps.stage_type = 'lost'
        ) then 'lost'
        when exists (
          select 1 from pipeline_cards pc
          join pipeline_stages ps on ps.id = pc.stage_id
          where pc.lead_id = l.id and ps.stage_type = 'in_progress'
        ) then 'in_progress'
        when l.status = 'active' then 'active'
        else 'other'
      end as classification,
      (p_from is null or (l.updated_at at time zone 'America/Sao_Paulo')::date >= p_from)
        and (p_to is null or (l.updated_at at time zone 'America/Sao_Paulo')::date <= p_to) as in_period
    from leads l
    where l.tenant_id = p_tenant_id
      and (not v_so_meus or l.assigned_to = auth.uid())
  )
  select
    count(*) filter (where classification = 'won'  and in_period),
    count(*) filter (where classification = 'lost' and in_period),
    count(*) filter (where classification = 'in_progress'),
    count(*) filter (where classification = 'active'),
    coalesce(sum(value) filter (where classification = 'won'  and in_period), 0),
    coalesce(sum(value) filter (where classification = 'in_progress'), 0),
    coalesce(sum(value) filter (where classification = 'lost' and in_period), 0)
  into v_won_count, v_lost_count, v_in_progress_count, v_active_count,
       v_faturamento, v_forecast, v_loss_value
  from lead_class;

  v_total := v_won_count + v_lost_count + v_in_progress_count + v_active_count;

  if v_won_count > 0 then v_avg := v_faturamento / v_won_count; end if;
  if (v_won_count + v_lost_count) > 0 then
    v_rate := round((v_won_count::numeric / (v_won_count + v_lost_count)) * 100);
  end if;

  -- Receita é o dinheiro que ENTROU no caixa: vem de lançamentos e contratos,
  -- não dos leads de ninguém. Só faz sentido no recorte da empresa.
  if v_gestor and not v_so_meus then
    select
      coalesce((
        select sum(amount) from financial_records
        where tenant_id = p_tenant_id and type = 'revenue'
          and (p_from is null or date >= p_from) and (p_to is null or date <= p_to)
      ), 0)
      +
      coalesce((
        select sum(l2.value) from leads l2
        where l2.tenant_id = p_tenant_id and l2.status = 'converted' and l2.value is not null
          and not exists (select 1 from client_contracts cc where cc.lead_id = l2.id and cc.status != 'cancelled')
          and not exists (select 1 from financial_records fr where fr.lead_id = l2.id)
          and (p_from is null or (l2.updated_at at time zone 'America/Sao_Paulo')::date >= p_from)
          and (p_to is null or (l2.updated_at at time zone 'America/Sao_Paulo')::date <= p_to)
      ), 0)
      +
      coalesce((
        select sum(inst.amount) from (
          select
            cc.amount,
            (cc.start_date + (gs || ' months')::interval)::date as due_date,
            cc.status,
            (cc.updated_at at time zone 'America/Sao_Paulo')::date as frozen_at
          from client_contracts cc
          cross join generate_series(0, coalesce(cc.installments, 1200) - 1) as gs
          where cc.tenant_id = p_tenant_id
            and cc.billing_type = 'recurring'
        ) inst
        where (
          (inst.status != 'active' and inst.due_date <= inst.frozen_at)
          or (inst.status = 'active' and (p_to is not null or inst.due_date <= v_today))
        )
        and (p_from is null or inst.due_date >= p_from)
        and (p_to is null or inst.due_date <= p_to)
      ), 0)
      +
      coalesce((
        select sum(cc.amount) from client_contracts cc
        where cc.tenant_id = p_tenant_id and cc.billing_type = 'one_time'
          and (
            (cc.status != 'active' and cc.start_date <= (cc.updated_at at time zone 'America/Sao_Paulo')::date)
            or (cc.status = 'active' and (p_to is not null or cc.start_date <= v_today))
          )
          and (p_from is null or cc.start_date >= p_from)
          and (p_to is null or cc.start_date <= p_to)
      ), 0)
    into v_receita;
  end if;

  return json_build_object(
    'revenue', v_faturamento,
    'faturamento', v_faturamento,
    'receita', v_receita,
    'forecast', v_forecast,
    'loss', v_loss_value,
    'won_count', v_won_count,
    'lost_count', v_lost_count,
    'in_progress_count', v_in_progress_count,
    'active_count', v_active_count,
    'total_with_value', v_total,
    'avg_ticket', v_avg,
    'conversion_rate', v_rate,
    'escopo', case when v_so_meus then 'meus' else 'empresa' end,
    'pode_trocar_escopo', v_gestor
  );
end; $function$;

revoke all on function public.get_pipeline_financial_metrics(uuid, date, date, text) from public, anon;
grant execute on function public.get_pipeline_financial_metrics(uuid, date, date, text) to authenticated;
