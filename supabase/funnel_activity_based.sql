-- ============================================================================
-- FUNIL POR DISPAROS (atividades) — substitui o cálculo via pipeline
-- + dedup de disparos (whatsapp via external_id) + policy para deletar disparos
--
-- RODA TUDO DE UMA VEZ. Idempotente — pode rodar de novo sem problema.
-- ============================================================================

-- 1. Coluna activity_types em funnel_steps -----------------------------------
ALTER TABLE funnel_steps
  ADD COLUMN IF NOT EXISTS activity_types TEXT[] DEFAULT NULL;

-- 2. Seed defaults para todos os tenants existentes --------------------------
-- "Contato feito" → ligação, whatsapp, e-mail
UPDATE funnel_steps
   SET activity_types = ARRAY['call', 'whatsapp', 'email']
 WHERE name = 'Contato feito'
   AND (activity_types IS NULL OR array_length(activity_types, 1) IS NULL);

-- "Reunião agendada" → reunião
UPDATE funnel_steps
   SET activity_types = ARRAY['meeting']
 WHERE name = 'Reunião agendada'
   AND (activity_types IS NULL OR array_length(activity_types, 1) IS NULL);

-- "Em negociação" fica SEM activity_types por padrão.
-- Configure manualmente na UI quais disparos contam para este passo
-- (ex: marcar 'meeting' também, ou criar uma regra própria depois).

-- 3. Dedup de disparos por external_id (whatsapp) ----------------------------
-- Só executa se a coluna external_id existir (migration whatsapp_integration.sql).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'lead_activities'
       AND column_name  = 'external_id'
  ) THEN
    -- Limpa duplicatas mantendo o mais antigo
    DELETE FROM lead_activities
     WHERE id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (
                      PARTITION BY tenant_id, external_id
                      ORDER BY created_at ASC
                    ) AS rn
           FROM lead_activities
          WHERE external_id IS NOT NULL
       ) d
       WHERE d.rn > 1
     );

    -- Cria UNIQUE INDEX se ainda não existir
    DROP INDEX IF EXISTS idx_lead_activities_external_id;
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname  = 'uq_lead_activities_external_id'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_lead_activities_external_id
               ON lead_activities (tenant_id, external_id)
               WHERE external_id IS NOT NULL';
    END IF;
  END IF;
END$$;

-- 4. RPC: lista passos do funil retornando activity_types --------------------
DROP FUNCTION IF EXISTS get_funnel_steps(uuid) CASCADE;

CREATE OR REPLACE FUNCTION get_funnel_steps(p_tenant_id uuid)
RETURNS TABLE (
  id              uuid,
  name            text,
  description     text,
  color           text,
  step_position   int,
  activity_types  text[],
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
  SELECT fs.id, fs.name, fs.description, fs.color,
         fs.position AS step_position, fs.activity_types, fs.created_at
    FROM funnel_steps fs
   WHERE fs.tenant_id = p_tenant_id
   ORDER BY fs.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_steps(uuid) TO authenticated;

-- 5. RPC: métricas do funil — SIMPLES, 100% por DISPAROS --------------------
-- Regra (final, depois de muitas iterações):
--   - Cada passo é INDEPENDENTE. Conta leads (DISTINCT) com pelo menos
--     UM disparo do tipo configurado em activity_types daquele passo.
--   - PRIMEIRO passo (sem activity_types) → todos os leads ativos+convertidos.
--   - ÚLTIMO passo → leads com status='converted' (independente de disparo).
--   - Sem cumulativo, sem pipeline, sem auto-jump. O que está em disparos =
--     o que aparece no funil.
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
  -- Disparos efetivos de cada passo (com auto-inferência pelo nome)
  effective_steps AS (
    SELECT
      fs.id, fs.name, fs.color, fs.position,
      CASE
        WHEN fs.activity_types IS NOT NULL
             AND array_length(fs.activity_types, 1) > 0 THEN fs.activity_types
        WHEN lower(fs.name) ~ '(contato|primeiro|inicial|abord)' THEN ARRAY['call','whatsapp','email']
        WHEN lower(fs.name) ~ '(whats)'                          THEN ARRAY['whatsapp']
        WHEN lower(fs.name) ~ '(liga|call)'                      THEN ARRAY['call']
        WHEN lower(fs.name) ~ '(email|e-mail)'                   THEN ARRAY['email']
        WHEN lower(fs.name) ~ '(reuni|agenda|meeting)'           THEN ARRAY['meeting']
        WHEN lower(fs.name) ~ '(negoci|propost|or[çc]ament)'      THEN ARRAY['meeting','call']
        ELSE NULL
      END AS effective_types
      FROM funnel_steps fs
     WHERE fs.tenant_id = p_tenant_id
  )
  SELECT
    es.id        AS step_id,
    es.name      AS step_name,
    es.color     AS step_color,
    es.position  AS step_position,

    -- Quantidade de LEADS DISTINCT que se encaixam nesse passo
    CASE
      -- ÚLTIMO passo: leads convertidos
      WHEN es.position = v_last_position THEN
        (SELECT COUNT(*)::int FROM leads l
          WHERE l.tenant_id = p_tenant_id
            AND l.status    = 'converted')

      -- PRIMEIRO passo sem disparos configurados: todos os leads ativos/convertidos
      WHEN es.position = v_first_position
           AND (es.effective_types IS NULL
                OR array_length(es.effective_types, 1) IS NULL) THEN
        (SELECT COUNT(*)::int FROM leads l
          WHERE l.tenant_id = p_tenant_id
            AND l.status IN ('active', 'converted'))

      -- Passo intermediário: HISTÓRICO COMPLETO de leads que passaram por aqui
      ELSE
        (SELECT COUNT(DISTINCT combined.lead_id)::int FROM (
           -- 1. DISPARO direto do tipo do passo (call/whatsapp/email/meeting)
           SELECT la.lead_id
             FROM lead_activities la
             JOIN leads l2 ON l2.id = la.lead_id
            WHERE l2.tenant_id = p_tenant_id
              AND l2.status IN ('active', 'converted')
              AND es.effective_types IS NOT NULL
              AND array_length(es.effective_types, 1) > 0
              AND la.type::text = ANY(es.effective_types)
           UNION ALL
           -- 2. PIPELINE ATUAL: lead está numa etapa mapeada para este passo
           SELECT pc.lead_id
             FROM pipeline_cards pc
             JOIN pipeline_stages ps ON ps.id = pc.stage_id
             JOIN leads l3 ON l3.id = pc.lead_id
            WHERE pc.tenant_id = p_tenant_id
              AND ps.funnel_step_id = es.id
              AND l3.status IN ('active', 'converted')
           UNION ALL
           -- 3. HISTÓRICO: stage_change PARA uma etapa mapeada para este passo
           -- (lead já passou por aqui mesmo que agora esteja em outra etapa)
           SELECT la2.lead_id
             FROM lead_activities la2
             JOIN leads l4 ON l4.id = la2.lead_id
             JOIN pipeline_stages ps2 ON ps2.tenant_id = p_tenant_id
                                     AND ps2.funnel_step_id = es.id
                                     AND ps2.name = (la2.metadata->>'to')
            WHERE la2.tenant_id = p_tenant_id
              AND la2.type      = 'stage_change'
              AND l4.status IN ('active', 'converted')
         ) combined)
    END AS count_in_step,

    -- count_at_or_beyond = mesmo número (passos são independentes)
    CASE
      WHEN es.position = v_last_position THEN
        (SELECT COUNT(*)::int FROM leads l
          WHERE l.tenant_id = p_tenant_id
            AND l.status    = 'converted')
      WHEN es.position = v_first_position
           AND (es.effective_types IS NULL
                OR array_length(es.effective_types, 1) IS NULL) THEN
        (SELECT COUNT(*)::int FROM leads l
          WHERE l.tenant_id = p_tenant_id
            AND l.status IN ('active', 'converted'))
      ELSE
        (SELECT COUNT(DISTINCT combined.lead_id)::int FROM (
           SELECT la.lead_id
             FROM lead_activities la
             JOIN leads l2 ON l2.id = la.lead_id
            WHERE l2.tenant_id = p_tenant_id
              AND l2.status IN ('active', 'converted')
              AND es.effective_types IS NOT NULL
              AND array_length(es.effective_types, 1) > 0
              AND la.type::text = ANY(es.effective_types)
           UNION ALL
           SELECT pc.lead_id
             FROM pipeline_cards pc
             JOIN pipeline_stages ps ON ps.id = pc.stage_id
             JOIN leads l3 ON l3.id = pc.lead_id
            WHERE pc.tenant_id = p_tenant_id
              AND ps.funnel_step_id = es.id
              AND l3.status IN ('active', 'converted')
           UNION ALL
           SELECT la2.lead_id
             FROM lead_activities la2
             JOIN leads l4 ON l4.id = la2.lead_id
             JOIN pipeline_stages ps2 ON ps2.tenant_id = p_tenant_id
                                     AND ps2.funnel_step_id = es.id
                                     AND ps2.name = (la2.metadata->>'to')
            WHERE la2.tenant_id = p_tenant_id
              AND la2.type      = 'stage_change'
              AND l4.status IN ('active', 'converted')
         ) combined)
    END AS count_at_or_beyond,

    -- count_lost_here: leads 'lost' com pelo menos um disparo correspondente
    CASE
      WHEN es.effective_types IS NOT NULL
           AND array_length(es.effective_types, 1) > 0 THEN
        (SELECT COUNT(DISTINCT la.lead_id)::int
           FROM lead_activities la
           JOIN leads l ON l.id = la.lead_id
          WHERE l.tenant_id = p_tenant_id
            AND l.status    = 'lost'
            AND la.type::text = ANY(es.effective_types))
      ELSE 0
    END AS count_lost_here

    FROM effective_steps es
   ORDER BY es.position ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_funnel_metrics(uuid) TO authenticated;

-- 6. Policy: permitir EXCLUIR disparos --------------------------------------
-- Autor sempre pode excluir o próprio. Admin/manager pode excluir qualquer um
-- do tenant. Super admin libera tudo.
DROP POLICY IF EXISTS "tenant_members_delete_activities" ON lead_activities;

CREATE POLICY "tenant_members_delete_activities" ON lead_activities
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND active = true
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_memberships m
         WHERE m.user_id   = auth.uid()
           AND m.tenant_id = lead_activities.tenant_id
           AND m.active    = true
           AND m.role IN ('admin', 'manager')
      )
      OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    )
  );

-- 7. RPC de diagnóstico: confirma que a migration foi aplicada --------------
-- Frontend chama isso para detectar se o usuário ainda está na função antiga.
CREATE OR REPLACE FUNCTION funnel_version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'activity-based-v10'::text;
$$;

GRANT EXECUTE ON FUNCTION funnel_version() TO authenticated;

-- 8. RPC de DEBUG: mostra exatamente o que tem no banco para o funil --------
-- Use para diagnosticar quando o funil não está contabilizando.
-- No SQL editor: SELECT * FROM debug_funnel('<seu-tenant-id>');
CREATE OR REPLACE FUNCTION debug_funnel(p_tenant_id uuid)
RETURNS TABLE (
  info  text,
  value text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'Funnel version'::text, funnel_version()
  UNION ALL
  SELECT 'Total leads', COUNT(*)::text FROM leads WHERE tenant_id = p_tenant_id
  UNION ALL
  SELECT 'Leads ativos', COUNT(*)::text FROM leads
   WHERE tenant_id = p_tenant_id AND status = 'active'
  UNION ALL
  SELECT 'Leads convertidos', COUNT(*)::text FROM leads
   WHERE tenant_id = p_tenant_id AND status = 'converted'
  UNION ALL
  SELECT 'Leads perdidos', COUNT(*)::text FROM leads
   WHERE tenant_id = p_tenant_id AND status = 'lost'
  UNION ALL
  SELECT 'Total de disparos (todos os tipos)', COUNT(*)::text FROM lead_activities
   WHERE tenant_id = p_tenant_id
  UNION ALL
  SELECT 'Disparos por tipo: ' || type::text, COUNT(*)::text
    FROM lead_activities WHERE tenant_id = p_tenant_id
   GROUP BY type
  UNION ALL
  SELECT 'Leads DISTINCT com pelo menos 1 disparo "meeting"',
         COUNT(DISTINCT la.lead_id)::text
    FROM lead_activities la
    JOIN leads l ON l.id = la.lead_id
   WHERE l.tenant_id = p_tenant_id
     AND la.type = 'meeting'
     AND l.status IN ('active', 'converted')
  UNION ALL
  SELECT 'Leads DISTINCT com pelo menos 1 disparo "call"',
         COUNT(DISTINCT la.lead_id)::text
    FROM lead_activities la
    JOIN leads l ON l.id = la.lead_id
   WHERE l.tenant_id = p_tenant_id
     AND la.type = 'call'
     AND l.status IN ('active', 'converted')
  UNION ALL
  SELECT 'Passo funil: ' || fs.position::text || ' "' || fs.name || '"',
         'activity_types = ' || COALESCE(fs.activity_types::text, 'NULL')
    FROM funnel_steps fs
   WHERE fs.tenant_id = p_tenant_id
   ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_funnel(uuid) TO authenticated;
