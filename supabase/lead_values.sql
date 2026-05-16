-- ============================================================================
-- Sistema de valores por lead + tipo de etapa da pipeline
-- ============================================================================

-- 1. Adiciona campo valor no lead (opcional)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS value NUMERIC(12,2) DEFAULT NULL;

-- 2. Adiciona tipo de etapa: in_progress | won | lost
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS stage_type TEXT NOT NULL DEFAULT 'in_progress'
  CHECK (stage_type IN ('in_progress', 'won', 'lost'));

-- 3. Migra etapas existentes baseado no nome + is_final
UPDATE pipeline_stages SET stage_type = 'won'
WHERE is_final = true
  AND (lower(name) LIKE '%fechad%'
    OR lower(name) LIKE '%ganho%'
    OR lower(name) LIKE '%won%');

UPDATE pipeline_stages SET stage_type = 'lost'
WHERE is_final = true
  AND (lower(name) LIKE '%perdid%'
    OR lower(name) LIKE '%lost%');

-- 4. RPC: métricas financeiras do dashboard (baseadas em valor + tipo de etapa)
CREATE OR REPLACE FUNCTION get_pipeline_financial_metrics(
  p_tenant_id uuid,
  p_from      date DEFAULT NULL,
  p_to        date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue   numeric := 0;
  v_forecast  numeric := 0;
  v_loss      numeric := 0;
  v_won_count int     := 0;
  v_lost_count int    := 0;
  v_in_progress_count int := 0;
  v_total_with_value  int := 0;
  v_avg_ticket numeric := 0;
  v_conv_rate  int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships um
    WHERE um.user_id = auth.uid() AND um.tenant_id = p_tenant_id AND um.active = true
  ) AND NOT EXISTS (
    SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Receita (etapas WON)
  SELECT
    COALESCE(SUM(l.value), 0),
    COUNT(*) FILTER (WHERE l.value IS NOT NULL)
  INTO v_revenue, v_won_count
  FROM leads l
  JOIN pipeline_cards pc ON pc.lead_id = l.id
  JOIN pipeline_stages ps ON ps.id = pc.stage_id
  WHERE l.tenant_id = p_tenant_id
    AND ps.stage_type = 'won'
    AND (p_from IS NULL OR pc.moved_at >= p_from)
    AND (p_to   IS NULL OR pc.moved_at < (p_to + 1));

  -- Previsão (etapas IN_PROGRESS)
  SELECT
    COALESCE(SUM(l.value), 0),
    COUNT(*) FILTER (WHERE l.value IS NOT NULL)
  INTO v_forecast, v_in_progress_count
  FROM leads l
  JOIN pipeline_cards pc ON pc.lead_id = l.id
  JOIN pipeline_stages ps ON ps.id = pc.stage_id
  WHERE l.tenant_id = p_tenant_id
    AND ps.stage_type = 'in_progress';

  -- Perdas (etapas LOST)
  SELECT
    COALESCE(SUM(l.value), 0),
    COUNT(*) FILTER (WHERE l.value IS NOT NULL)
  INTO v_loss, v_lost_count
  FROM leads l
  JOIN pipeline_cards pc ON pc.lead_id = l.id
  JOIN pipeline_stages ps ON ps.id = pc.stage_id
  WHERE l.tenant_id = p_tenant_id
    AND ps.stage_type = 'lost'
    AND (p_from IS NULL OR pc.moved_at >= p_from)
    AND (p_to   IS NULL OR pc.moved_at < (p_to + 1));

  v_total_with_value := v_won_count + v_lost_count + v_in_progress_count;

  -- Ticket médio = receita / nº fechamentos
  IF v_won_count > 0 THEN
    v_avg_ticket := v_revenue / v_won_count;
  END IF;

  -- Taxa de conversão = won / (won + lost) * 100
  IF (v_won_count + v_lost_count) > 0 THEN
    v_conv_rate := ROUND((v_won_count::numeric / (v_won_count + v_lost_count)) * 100);
  END IF;

  RETURN json_build_object(
    'revenue',            v_revenue,
    'forecast',           v_forecast,
    'loss',               v_loss,
    'won_count',          v_won_count,
    'lost_count',         v_lost_count,
    'in_progress_count',  v_in_progress_count,
    'total_with_value',   v_total_with_value,
    'avg_ticket',         v_avg_ticket,
    'conversion_rate',    v_conv_rate
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_pipeline_financial_metrics(uuid, date, date) TO authenticated;

-- 5. RPC: métricas por vendedor (para Reports)
CREATE OR REPLACE FUNCTION get_seller_financial_metrics(
  p_tenant_id uuid,
  p_from      date DEFAULT NULL,
  p_to        date DEFAULT NULL
)
RETURNS TABLE (
  user_id        uuid,
  email          text,
  full_name      text,
  total_leads    int,
  won_count      int,
  lost_count     int,
  revenue        numeric,
  forecast       numeric,
  loss           numeric,
  avg_ticket     numeric,
  conv_rate      int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships um
    WHERE um.user_id = auth.uid() AND um.tenant_id = p_tenant_id AND um.active = true
  ) AND NOT EXISTS (
    SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT m.user_id AS uid, p.email, p.full_name
    FROM user_memberships m
    LEFT JOIN profiles p ON p.id = m.user_id
    WHERE m.tenant_id = p_tenant_id AND m.active = true
  ),
  -- Leads do vendedor no período
  lead_counts AS (
    SELECT l.assigned_to AS uid, COUNT(*) AS cnt
    FROM leads l
    WHERE l.tenant_id = p_tenant_id
      AND l.assigned_to IS NOT NULL
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to   IS NULL OR l.created_at < (p_to + 1))
    GROUP BY l.assigned_to
  ),
  -- Métricas por vendedor agrupadas por tipo de etapa
  seller_stage AS (
    SELECT
      l.assigned_to AS uid,
      ps.stage_type,
      COUNT(*) AS cnt,
      COALESCE(SUM(l.value), 0) AS total_value
    FROM leads l
    JOIN pipeline_cards pc ON pc.lead_id = l.id
    JOIN pipeline_stages ps ON ps.id = pc.stage_id
    WHERE l.tenant_id = p_tenant_id
      AND l.assigned_to IS NOT NULL
      AND (
        ps.stage_type = 'in_progress'
        OR (p_from IS NULL OR pc.moved_at >= p_from)
      )
      AND (
        ps.stage_type = 'in_progress'
        OR (p_to IS NULL OR pc.moved_at < (p_to + 1))
      )
    GROUP BY l.assigned_to, ps.stage_type
  )
  SELECT
    m.uid                                                      AS user_id,
    COALESCE(m.email, '—')                                     AS email,
    m.full_name                                                AS full_name,
    COALESCE(lc.cnt, 0)::int                                   AS total_leads,
    COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won'), 0)::int  AS won_count,
    COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'lost'), 0)::int AS lost_count,
    COALESCE(SUM(ss.total_value) FILTER (WHERE ss.stage_type = 'won'), 0)        AS revenue,
    COALESCE(SUM(ss.total_value) FILTER (WHERE ss.stage_type = 'in_progress'), 0) AS forecast,
    COALESCE(SUM(ss.total_value) FILTER (WHERE ss.stage_type = 'lost'), 0)       AS loss,
    CASE
      WHEN COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won'), 0) > 0
      THEN COALESCE(SUM(ss.total_value) FILTER (WHERE ss.stage_type = 'won'), 0)
           / SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won')
      ELSE 0
    END AS avg_ticket,
    CASE
      WHEN (COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won'), 0)
          + COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'lost'), 0)) > 0
      THEN ROUND((COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won'), 0)::numeric
                / (COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'won'), 0)
                 + COALESCE(SUM(ss.cnt) FILTER (WHERE ss.stage_type = 'lost'), 0))) * 100)::int
      ELSE 0
    END AS conv_rate
  FROM members m
  LEFT JOIN lead_counts  lc ON lc.uid = m.uid
  LEFT JOIN seller_stage ss ON ss.uid = m.uid
  GROUP BY m.uid, m.email, m.full_name, lc.cnt
  ORDER BY revenue DESC, total_leads DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_seller_financial_metrics(uuid, date, date) TO authenticated;

-- 6. RPC: funil com soma de valores por etapa
CREATE OR REPLACE FUNCTION get_funnel_with_values(p_tenant_id uuid)
RETURNS TABLE (
  stage_id        uuid,
  stage_name      text,
  color           text,
  stage_type      text,
  stage_position  int,
  lead_count      int,
  total_value     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships um
    WHERE um.user_id = auth.uid() AND um.tenant_id = p_tenant_id AND um.active = true
  ) AND NOT EXISTS (
    SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    ps.id            AS stage_id,
    ps.name          AS stage_name,
    ps.color         AS color,
    ps.stage_type    AS stage_type,
    ps.position      AS stage_position,
    COALESCE(COUNT(pc.id), 0)::int       AS lead_count,
    COALESCE(SUM(l.value), 0)             AS total_value
  FROM pipeline_stages ps
  LEFT JOIN pipeline_cards pc ON pc.stage_id = ps.id
  LEFT JOIN leads l ON l.id = pc.lead_id
  WHERE ps.tenant_id = p_tenant_id
  GROUP BY ps.id, ps.name, ps.color, ps.stage_type, ps.position
  ORDER BY ps.position;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_with_values(uuid) TO authenticated;
