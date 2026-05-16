-- ============================================================================
-- Funil Configurável
-- Cada tenant define seus passos do funil. Pipeline_stages podem ser mapeados.
-- ============================================================================

-- 1. Tabela de passos do funil
CREATE TABLE IF NOT EXISTS funnel_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text NOT NULL DEFAULT '#40a0ff',
  position    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_funnel_steps_tenant_pos
  ON funnel_steps (tenant_id, position);

-- 2. RLS
ALTER TABLE funnel_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_see_funnel" ON funnel_steps;
CREATE POLICY "tenant_members_see_funnel" ON funnel_steps
  FOR SELECT USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant_managers_manage_funnel" ON funnel_steps;
CREATE POLICY "tenant_managers_manage_funnel" ON funnel_steps
  FOR ALL
  USING (is_tenant_manager(tenant_id))
  WITH CHECK (is_tenant_manager(tenant_id));

-- 3. FK em pipeline_stages → funnel_steps
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS funnel_step_id uuid REFERENCES funnel_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_funnel_step
  ON pipeline_stages (funnel_step_id) WHERE funnel_step_id IS NOT NULL;

-- 4. Seed dos 5 passos padrão para cada tenant existente
INSERT INTO funnel_steps (tenant_id, name, color, position)
SELECT t.id, 'Leads captados', '#888888', 0 FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO funnel_steps (tenant_id, name, color, position)
SELECT t.id, 'Contato feito', '#40a0ff', 1 FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO funnel_steps (tenant_id, name, color, position)
SELECT t.id, 'Reunião agendada', '#a78bfa', 2 FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO funnel_steps (tenant_id, name, color, position)
SELECT t.id, 'Em negociação', '#ec4899', 3 FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO funnel_steps (tenant_id, name, color, position)
SELECT t.id, 'Fechado', '#00e676', 4 FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 5. Trigger: ao criar novo tenant, semeia os 5 passos
CREATE OR REPLACE FUNCTION seed_default_funnel_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO funnel_steps (tenant_id, name, color, position) VALUES
    (NEW.id, 'Leads captados',  '#888888', 0),
    (NEW.id, 'Contato feito',   '#40a0ff', 1),
    (NEW.id, 'Reunião agendada','#a78bfa', 2),
    (NEW.id, 'Em negociação',   '#ec4899', 3),
    (NEW.id, 'Fechado',         '#00e676', 4)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_funnel_steps ON tenants;
CREATE TRIGGER trigger_seed_funnel_steps
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION seed_default_funnel_steps();

-- 6. RPC: lista passos do funil
CREATE OR REPLACE FUNCTION get_funnel_steps(p_tenant_id uuid)
RETURNS TABLE (
  id              uuid,
  name            text,
  description     text,
  color           text,
  step_position   int,
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_tenant_member(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  RETURN QUERY
  SELECT
    fs.id              AS id,
    fs.name            AS name,
    fs.description     AS description,
    fs.color           AS color,
    fs.position        AS step_position,
    fs.created_at      AS created_at
  FROM funnel_steps fs
  WHERE fs.tenant_id = p_tenant_id
  ORDER BY fs.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_steps(uuid) TO authenticated;

-- 7. RPC: reorder atômico
CREATE OR REPLACE FUNCTION reorder_funnel_steps(p_tenant_id uuid, p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_item jsonb;
BEGIN
  IF NOT is_tenant_manager(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
    UPDATE funnel_steps
    SET position = (v_item->>'position')::int
    WHERE id = (v_item->>'id')::uuid AND tenant_id = p_tenant_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION reorder_funnel_steps(uuid, jsonb) TO authenticated;

-- 8. RPC: funil com contagem cumulativa
-- Para cada step, retorna:
--   - count_in_step: leads cuja etapa atual mapeia para ESTE step
--   - count_at_or_beyond: leads que estão neste step OU em step mais à frente (cumulativo)
--   - count_lost_here: leads perdidos cuja última etapa estava neste step
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
BEGIN
  IF NOT is_tenant_member(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  RETURN QUERY
  WITH lead_step_position AS (
    -- Para cada lead, identifica a posição do funil_step da etapa atual no pipeline
    SELECT
      l.id              AS lead_id,
      l.status          AS status,
      fs.id             AS funnel_step_id,
      fs.position       AS step_position
    FROM leads l
    LEFT JOIN pipeline_cards pc ON pc.lead_id = l.id
    LEFT JOIN pipeline_stages ps ON ps.id = pc.stage_id
    LEFT JOIN funnel_steps fs ON fs.id = ps.funnel_step_id
    WHERE l.tenant_id = p_tenant_id
  )
  SELECT
    fs.id                                                                                       AS step_id,
    fs.name                                                                                     AS step_name,
    fs.color                                                                                    AS step_color,
    fs.position                                                                                 AS step_position,
    COALESCE(COUNT(*) FILTER (
      WHERE lsp.funnel_step_id = fs.id AND lsp.status NOT IN ('lost', 'archived')
    ), 0)::int                                                                                  AS count_in_step,
    COALESCE(COUNT(*) FILTER (
      WHERE lsp.step_position >= fs.position AND lsp.status NOT IN ('lost', 'archived')
    ), 0)::int                                                                                  AS count_at_or_beyond,
    COALESCE(COUNT(*) FILTER (
      WHERE lsp.funnel_step_id = fs.id AND lsp.status = 'lost'
    ), 0)::int                                                                                  AS count_lost_here
  FROM funnel_steps fs
  LEFT JOIN lead_step_position lsp ON true
  WHERE fs.tenant_id = p_tenant_id
  GROUP BY fs.id, fs.name, fs.color, fs.position
  ORDER BY fs.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_metrics(uuid) TO authenticated;
