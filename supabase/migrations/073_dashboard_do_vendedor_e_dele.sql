-- Dashboard: o número que o vendedor vê é o DELE.
--
-- Antes, `get_pipeline_financial_metrics` somava a empresa inteira e, no fim,
-- zerava só os valores em R$ pra quem é vendedor. As CONTAGENS continuavam da
-- empresa — quantos ganhos, quantos perdidos, quantos em andamento, taxa de
-- conversão — então o Dashboard dele mostrava o movimento da casa toda, e o
-- volume de negócios dava pra deduzir mesmo com os valores zerados.
--
-- Agora ele vê os leads atribuídos a ele, com os valores dele: vira painel de
-- desempenho pessoal em vez de um resumo capado da empresa. Receita continua
-- fora — é o caixa (lançamentos e contratos), não a soma dos leads de alguém.
--
-- O JSON passa a devolver `escopo` ('meus' ou 'empresa') pra tela saber que
-- título dar sem deduzir pelo cargo. Gestor, admin e super admin não mudam.
create or replace function public.get_pipeline_financial_metrics(p_tenant_id uuid, p_from date default null, p_to date default null)
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
  v_role user_role;
  v_so_meus boolean;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from user_memberships um where um.user_id = auth.uid() and um.tenant_id = p_tenant_id and um.active = true)
     and not exists (select 1 from super_admins sa where sa.user_id = auth.uid())
  then raise exception 'Unauthorized'; end if;

  select um.role into v_role
  from user_memberships um
  where um.user_id = auth.uid() and um.tenant_id = p_tenant_id and um.active = true
  limit 1;

  -- `is distinct from` porque super admin não tem papel nesta empresa — com
  -- `<>` o NULL derrubaria o filtro e ele não veria nada.
  v_so_meus := v_role is not distinct from 'seller'::user_role;

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
  -- não dos leads de ninguém. Continua sendo assunto de gestor.
  if not v_so_meus then
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
    'escopo', case when v_so_meus then 'meus' else 'empresa' end
  );
end; $function$;

revoke all on function public.get_pipeline_financial_metrics(uuid, date, date) from public, anon;
grant execute on function public.get_pipeline_financial_metrics(uuid, date, date) to authenticated;
