-- ============================================================================
-- FUNIL — versão STRICT: conta apenas leads com PIPELINE_CARD ATIVO.
-- Se pipeline está vazia, funil mostra ZERO (não puxa de leads histórico
-- sem card, nem de disparos avulsos).
-- Substitui get_funnel_metrics anterior.
-- ============================================================================

DROP FUNCTION IF EXISTS get_funnel_metrics(uuid) CASCADE;

CREATE OR REPLACE FUNCTION get_funnel_metrics(p_tenant_id uuid)
RETURNS TABLE (
  step_id              uuid,
  step_name            text,
  step_color           text,
  step_position        int,
  count_in_step        int,
  count_at_or_beyond   int,
  count_lost_here      int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_position int;
  v_last_position  int;
BEGIN
  IF NOT is_tenant_member(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT MIN(position), MAX(position)
    INTO v_first_position, v_last_position
    FROM funnel_steps WHERE tenant_id = p_tenant_id;

  IF v_first_position IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH
  -- Apenas leads com PIPELINE_CARD ativo. Lead sem card não aparece no funil.
  leads_in_pipeline AS (
    SELECT DISTINCT l.id, l.status::text AS lead_status
      FROM leads l
      JOIN pipeline_cards pc ON pc.lead_id = l.id
     WHERE l.tenant_id  = p_tenant_id
       AND pc.tenant_id = p_tenant_id
  ),
  -- Posição alcançada via PIPELINE atual (stage → funnel_step mapeado)
  lead_pipeline_pos AS (
    SELECT pc.lead_id, MAX(fs.position) AS max_pos
      FROM pipeline_cards pc
      JOIN pipeline_stages ps ON ps.id = pc.stage_id
      JOIN funnel_steps   fs  ON fs.id = ps.funnel_step_id
     WHERE pc.tenant_id = p_tenant_id
       AND ps.tenant_id = p_tenant_id
       AND fs.tenant_id = p_tenant_id
     GROUP BY pc.lead_id
  ),
  lead_position AS (
    SELECT
      lip.id           AS lead_id,
      lip.lead_status,
      GREATEST(
        v_first_position,
        COALESCE(lpp.max_pos, v_first_position)
      ) AS current_position
      FROM leads_in_pipeline lip
      LEFT JOIN lead_pipeline_pos lpp ON lpp.lead_id = lip.id
  )
  SELECT
    fs.id        AS step_id,
    fs.name      AS step_name,
    fs.color     AS step_color,
    fs.position  AS step_position,
    -- count_in_step: leads ativos exatamente nesse passo (ou status=converted no último)
    CASE
      WHEN fs.position = v_last_position THEN
        COALESCE(COUNT(*) FILTER (
          WHERE lp.lead_status = 'converted'
        ), 0)::int
      ELSE
        COALESCE(COUNT(*) FILTER (
          WHERE lp.current_position = fs.position
            AND lp.lead_status IN ('active', 'converted')
        ), 0)::int
    END AS count_in_step,
    -- count_at_or_beyond: cumulativo
    CASE
      WHEN fs.position = v_last_position THEN
        COALESCE(COUNT(*) FILTER (
          WHERE lp.lead_status = 'converted'
        ), 0)::int
      ELSE
        COALESCE(COUNT(*) FILTER (
          WHERE lp.current_position >= fs.position
            AND lp.lead_status IN ('active', 'converted')
        ), 0)::int
    END AS count_at_or_beyond,
    COALESCE(COUNT(*) FILTER (
      WHERE lp.current_position = fs.position
        AND lp.lead_status = 'lost'
    ), 0)::int AS count_lost_here
    FROM funnel_steps fs
    LEFT JOIN lead_position lp ON true
   WHERE fs.tenant_id = p_tenant_id
   GROUP BY fs.id, fs.name, fs.color, fs.position
   ORDER BY fs.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_metrics(uuid) TO authenticated;

-- Bumpa versão para o frontend detectar
CREATE OR REPLACE FUNCTION funnel_version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'pipeline-only-v11'::text;
$$;

GRANT EXECUTE ON FUNCTION funnel_version() TO authenticated;
