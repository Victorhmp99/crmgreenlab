-- Quem é o responsável pelo lead, e quem pode mudar isso.
--
-- `leads.assigned_to` já existia e já alimentava relatório e dashboard, mas
-- não havia NENHUMA tela pra preencher: o campo só era escrito pela
-- importação. Por isso a maioria dos leads está sem dono — e sem dono não há
-- relatório de vendas por pessoa nem conversão individual.
--
-- A política de UPDATE em `leads` é `is_tenant_member`, ou seja, qualquer um
-- pode escrever qualquer coisa nessa coluna. A tela vai esconder o que não
-- pode, mas esconder não é proteger: a regra tem que valer aqui.

-- ── 1. Quem pode trocar o responsável ──────────────────────────────────────
create or replace function public.tg_valida_responsavel_do_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem     uuid := auth.uid();
  v_anterior uuid := case when tg_op = 'UPDATE' then old.assigned_to else null end;
begin
  -- Rotina interna (importação, webhook, cron) não tem usuário logado. Quem
  -- usa a chave de serviço já tem acesso total: travar aqui não protegeria
  -- nada e quebraria a entrada de lead.
  if v_quem is null then
    return new;
  end if;

  if new.assigned_to is not distinct from v_anterior then
    return new;
  end if;

  -- Responsável tem que ser gente DESTA empresa e ativa. Sem isto, um id
  -- qualquer entra na coluna e o lead some de todos os relatórios sem erro.
  if new.assigned_to is not null and not exists (
    select 1 from user_memberships um
    where um.user_id = new.assigned_to and um.tenant_id = new.tenant_id and um.active
  ) then
    raise exception 'Responsável precisa ser um usuário ativo desta empresa';
  end if;

  if is_tenant_manager(new.tenant_id)
     or exists (select 1 from super_admins sa where sa.user_id = v_quem)
  then
    return new;  -- gestor e admin distribuem como quiserem
  end if;

  -- Vendedor: só assume pra si, e só lead que está sem dono. Assim ele não
  -- tira lead do colega nem empurra lead ruim pra outro. Quem rearranja é o
  -- gestor.
  if v_anterior is not null then
    raise exception 'Este lead já tem responsável. Peça ao gestor para transferir.';
  end if;
  if new.assigned_to is distinct from v_quem then
    raise exception 'Você só pode assumir o lead para si';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_valida_responsavel_do_lead on leads;
create trigger trg_valida_responsavel_do_lead
  before insert or update of assigned_to on leads
  for each row execute function tg_valida_responsavel_do_lead();

-- ── 2. Arrastou pra venda, a venda é de quem arrastou ──────────────────────
-- Só quando o lead está SEM dono: um gestor organizando o quadro não pode
-- tomar a venda do vendedor sem perceber, e o relatório não muda sozinho pelas
-- costas de ninguém. Com dono definido, quem troca é o gestor, na mão.
create or replace function public.tg_venda_vai_pra_quem_arrastou()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.stage_id is not distinct from old.stage_id then return new; end if;

  if not exists (
    select 1 from pipeline_stages ps
    where ps.id = new.stage_id and ps.stage_type = 'won'
  ) then
    return new;
  end if;

  update leads
     set assigned_to = auth.uid()
   where id = new.lead_id
     and tenant_id = new.tenant_id
     and assigned_to is null;

  return new;
end;
$$;

drop trigger if exists trg_venda_vai_pra_quem_arrastou on pipeline_cards;
create trigger trg_venda_vai_pra_quem_arrastou
  after update of stage_id on pipeline_cards
  for each row execute function tg_venda_vai_pra_quem_arrastou();

-- ── 3. Dashboard: o gestor também vê o número DELE ─────────────────────────
-- O vendedor já vê só o dele (073). Faltava o outro lado: o gestor vende
-- também, e não tinha como separar o que é dele do consolidado.
--
-- Parâmetro novo exige DROP antes: com CREATE OR REPLACE nasce uma SEGUNDA
-- função e a chamada de 3 argumentos vira "function is not unique" — foi o
-- que quebrou a criação de contrato na migration 044. Não repetir.
drop function if exists public.get_pipeline_financial_metrics(uuid, date, date);

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
  v_role user_role;
  v_gestor boolean;
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

  v_gestor := is_tenant_manager(p_tenant_id)
              or exists (select 1 from super_admins sa where sa.user_id = auth.uid());

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
