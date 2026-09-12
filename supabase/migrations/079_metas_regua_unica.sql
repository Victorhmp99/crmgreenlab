-- Metas, etapa 1: a régua é UMA e mora no banco.
--
-- O progresso da meta era calculado no navegador, com uma regra própria: venda
-- era "status = converted", enquanto o Dashboard e o Relatório contam venda
-- como "convertido OU card na etapa de venda". Três telas, três números para
-- a mesma pergunta. E o alvo de FATURAMENTO existia no formulário e nunca foi
-- calculado — a barra simplesmente não aparecia.
--
-- Agora as duas funções abaixo usam exatamente a classificação de
-- `get_pipeline_financial_metrics`. O que o Dashboard chama de venda, a meta
-- chama de venda.
--
-- O que o vendedor consegue fazer com isso: nada além de ler. Meta é criada e
-- editada só por gestor (política `managers_manage_goals`), e o número vem do
-- banco — não há estado no navegador para manipular.

-- ── Classificação de lead, uma vez só ───────────────────────────────────────
-- Existia copiada dentro de duas funções. Vira uma, e as três (dashboard,
-- meta, ranking) passam a apontar pra ela. Mudar a regra de venda um dia é
-- mudar aqui.
create or replace function public.lead_esta_ganho(p_lead leads)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_lead.status = 'converted'
      or exists (
        select 1 from pipeline_cards pc
        join pipeline_stages ps on ps.id = pc.stage_id
        where pc.lead_id = p_lead.id and ps.stage_type = 'won'
      );
$$;
revoke all on function public.lead_esta_ganho(leads) from public, anon, authenticated;

-- ── Progresso das metas ─────────────────────────────────────────────────────
-- Devolve o realizado de cada meta que a pessoa pode ver: as dela, ou todas
-- se for gestor. Uma chamada pra lista inteira — antes eram três consultas
-- POR META, no navegador.
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
    -- Leads captados: atribuídos à pessoa, criados no período.
    (select count(*)::int from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and (l.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date),
    -- Contatos: leads DISTINTOS que a pessoa tocou no período. Dez ligações
    -- pro mesmo lead contam um. Registro manual conta — decisão do Victor:
    -- quem infla contato sem agendar nem vender fica exposto na auditoria.
    (select count(distinct a.lead_id)::int from lead_activities a
      where a.tenant_id = g.tenant_id and a.user_id = g.user_id
        and a.type::text <> 'import'
        and (a.created_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date),
    -- Vendas: mesma régua do Dashboard.
    (select count(*)::int from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date),
    -- Faturamento: soma do valor das vendas acima. Nunca tinha sido calculado.
    (select coalesce(sum(l.value), 0) from leads l
      where l.tenant_id = g.tenant_id and l.assigned_to = g.user_id
        and lead_esta_ganho(l)
        and (l.updated_at at time zone 'America/Sao_Paulo')::date between g.start_date and g.end_date)
  from goals g
  where g.tenant_id = p_tenant_id
    and (v_ve_tudo or g.user_id = auth.uid())
    and (not p_only_active or g.end_date >= (now() at time zone 'America/Sao_Paulo')::date);
end;
$$;

revoke all on function public.progresso_das_metas(uuid, boolean) from public, anon;
grant execute on function public.progresso_das_metas(uuid, boolean) to authenticated;

-- ── Ranking do período ──────────────────────────────────────────────────────
-- O ranking chamava `get_tenant_users`, que é restrita a gestor — pra
-- vendedor a aba vinha VAZIA ("nenhum dado de equipe"), sem erro visível. E
-- ranking é justamente pra vendedor olhar.
--
-- Todo membro vê posições e contagens. FATURAMENTO só vem pra gestor: número
-- em reais do colega é assunto de gestão (migration 072) — pra vendedor vem
-- nulo, e a tela não mostra a coluna.
create or replace function public.ranking_do_periodo(
  p_tenant_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  user_id      uuid,
  email        text,
  full_name    text,
  leads        integer,
  contatos     integer,
  vendas       integer,
  faturamento  numeric,
  pontos       integer
)
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
    where um.tenant_id = p_tenant_id and um.active
      and um.role in ('manager', 'seller')
  ),
  numeros as (
    select
      ps.uid,
      (select count(*)::int from leads l
        where l.tenant_id = p_tenant_id and l.assigned_to = ps.uid
          and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to) as leads,
      (select count(distinct a.lead_id)::int from lead_activities a
        where a.tenant_id = p_tenant_id and a.user_id = ps.uid
          and a.type::text <> 'import'
          and (a.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to) as contatos,
      (select count(*)::int from leads l
        where l.tenant_id = p_tenant_id and l.assigned_to = ps.uid
          and lead_esta_ganho(l)
          and (l.updated_at at time zone 'America/Sao_Paulo')::date between p_from and p_to) as vendas,
      (select coalesce(sum(l.value), 0) from leads l
        where l.tenant_id = p_tenant_id and l.assigned_to = ps.uid
          and lead_esta_ganho(l)
          and (l.updated_at at time zone 'America/Sao_Paulo')::date between p_from and p_to) as faturamento
    from pessoas ps
  )
  select
    ps.uid,
    coalesce(ps.email, '—'),
    ps.full_name,
    n.leads,
    n.contatos,
    n.vendas,
    case when v_gestor then n.faturamento else null end,
    -- Mesma pontuação que a tela já usava: venda vale três.
    (n.leads + n.contatos + n.vendas * 3)::int
  from pessoas ps
  join numeros n on n.uid = ps.uid
  order by 8 desc, 6 desc, 3 desc;
end;
$$;

revoke all on function public.ranking_do_periodo(uuid, date, date) from public, anon;
grant execute on function public.ranking_do_periodo(uuid, date, date) to authenticated;
