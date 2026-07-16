-- ============================================================================
-- Migration 019 — Vendedor não vê valores financeiros (Dashboard/RPC)
--
-- get_pipeline_financial_metrics só checava se o usuário era membro do
-- tenant, sem checar o cargo — um vendedor podia chamar a RPC direto
-- (ex: console do navegador) e ver receita/previsão/ticket médio mesmo
-- que a tela escondesse. Agora zera os campos monetários quando o cargo
-- é seller. Contagens (won_count, lost_count etc.) continuam, pois não
-- são dado financeiro.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pipeline_financial_metrics(p_tenant_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_revenue numeric := 0; v_forecast numeric := 0; v_loss_value numeric := 0;
  v_won_count int := 0; v_lost_count int := 0; v_in_progress_count int := 0;
  v_active_count int := 0;
  v_total int := 0; v_avg numeric := 0; v_rate int := 0;
  v_role user_role;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_memberships um WHERE um.user_id = auth.uid() AND um.tenant_id = p_tenant_id AND um.active = true)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT um.role INTO v_role
  FROM user_memberships um
  WHERE um.user_id = auth.uid() AND um.tenant_id = p_tenant_id AND um.active = true
  LIMIT 1;

  WITH lead_class AS (
    SELECT
      l.id,
      l.value,
      CASE
        WHEN l.status = 'converted' THEN 'won'
        WHEN EXISTS (
          SELECT 1 FROM pipeline_cards pc
          JOIN pipeline_stages ps ON ps.id = pc.stage_id
          WHERE pc.lead_id = l.id AND ps.stage_type = 'won'
        ) THEN 'won'
        WHEN l.status = 'lost' THEN 'lost'
        WHEN EXISTS (
          SELECT 1 FROM pipeline_cards pc
          JOIN pipeline_stages ps ON ps.id = pc.stage_id
          WHERE pc.lead_id = l.id AND ps.stage_type = 'lost'
        ) THEN 'lost'
        WHEN EXISTS (
          SELECT 1 FROM pipeline_cards pc
          JOIN pipeline_stages ps ON ps.id = pc.stage_id
          WHERE pc.lead_id = l.id AND ps.stage_type = 'in_progress'
        ) THEN 'in_progress'
        WHEN l.status = 'active' THEN 'active'
        ELSE 'other'
      END AS classification
    FROM leads l
    WHERE l.tenant_id = p_tenant_id
  )
  SELECT
    COUNT(*) FILTER (WHERE classification = 'won'),
    COUNT(*) FILTER (WHERE classification = 'lost'),
    COUNT(*) FILTER (WHERE classification = 'in_progress'),
    COUNT(*) FILTER (WHERE classification = 'active'),
    COALESCE(SUM(value) FILTER (WHERE classification = 'won'), 0),
    COALESCE(SUM(value) FILTER (WHERE classification = 'in_progress'), 0),
    COALESCE(SUM(value) FILTER (WHERE classification = 'lost'), 0)
  INTO v_won_count, v_lost_count, v_in_progress_count, v_active_count,
       v_revenue, v_forecast, v_loss_value
  FROM lead_class;

  v_total := v_won_count + v_lost_count + v_in_progress_count + v_active_count;

  IF v_won_count > 0 THEN v_avg := v_revenue / v_won_count; END IF;
  IF (v_won_count + v_lost_count) > 0 THEN
    v_rate := ROUND((v_won_count::numeric / (v_won_count + v_lost_count)) * 100);
  END IF;

  IF v_role = 'seller' THEN
    v_revenue := 0; v_forecast := 0; v_loss_value := 0; v_avg := 0;
  END IF;

  RETURN json_build_object(
    'revenue', v_revenue,
    'forecast', v_forecast,
    'loss', v_loss_value,
    'won_count', v_won_count,
    'lost_count', v_lost_count,
    'in_progress_count', v_in_progress_count,
    'active_count', v_active_count,
    'total_with_value', v_total,
    'avg_ticket', v_avg,
    'conversion_rate', v_rate
  );
END; $function$
