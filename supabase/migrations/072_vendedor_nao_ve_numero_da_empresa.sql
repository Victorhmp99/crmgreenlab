-- O que o vendedor enxerga de financeiro, metas e Meta Ads.
--
-- Nas TABELAS já estava certo: financeiro, contratos, campanhas e credenciais
-- do Meta exigem gestor ou admin, e o RLS recusa vendedor. Na TELA também: o
-- menu esconde e a rota redireciona.
--
-- O furo estava nas RPCs. Função SECURITY DEFINER roda ACIMA do RLS — é ela
-- que decide quem vê o quê, e estas decidiam apenas "é membro da empresa?".
-- Pela API, que é por onde alguém mal-intencionado vai de verdade, o vendedor
-- alcançava número que a tela nunca mostra pra ele.

-- ── 1. Ranking por vendedor: relatório de gestão ───────────────────────────
-- Devolve receita, ticket médio e taxa de conversão de CADA colega. A tela
-- que usa isso (Relatórios) já é restrita a gestor pela rota; só a função
-- aceitava qualquer um. Agora as duas dizem a mesma coisa.
--
-- Corrigido de passagem: `p_from`/`p_to` eram recebidos e IGNORADOS — o
-- período escolhido na tela não mexia neste bloco, embora mexesse no resto.
-- Ganho e perda passam a respeitar a data, do mesmo jeito que em
-- `get_pipeline_financial_metrics`: os dois relatórios precisam bater.
-- Previsão e total continuam retrato do AGORA, também como lá.
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
  IF NOT is_tenant_manager(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

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

-- ── 2. Metas: o vendedor vê a dele ─────────────────────────────────────────
-- A política da tabela `goals` já diz exatamente isso ("a própria, ou gestor
-- vê todas"). A RPC passava por cima e devolvia a meta de faturamento de todo
-- mundo. Não é decisão de produto: é a função contrariando a regra que a
-- própria tabela declara.
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

  v_ve_tudo := is_tenant_manager(p_tenant_id)
               or exists (select 1 from super_admins sa where sa.user_id = auth.uid());

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

-- ── 3. Fila de eventos do Meta: é rotina, não botão ────────────────────────
-- Sem checagem nenhuma e chamável por qualquer pessoa logada: dispara o envio
-- de evento de conversão de TODAS as empresas pra fora. Quem chama é o cron.
-- Os dois botões da tela (`enviar_eventos_meta_agora`, `reenfileirar_eventos_meta`)
-- já exigem admin e continuam funcionando — rodam como dono e não dependem
-- deste grant.
revoke all on function public.drenar_fila_meta_conversions() from public, anon, authenticated;
grant execute on function public.drenar_fila_meta_conversions() to service_role;
