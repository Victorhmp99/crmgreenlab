-- ============================================================================
-- Migration 014 — start_stage_id em pipelines + pipeline_id em whatsapp_settings
--
-- Objetivo:
--   • Cada pipeline define qual etapa é o ponto de entrada de novos leads
--     (start_stage_id). Leads que chegam via automação/webhook caem aqui.
--   • whatsapp_settings ganha pipeline_id para vincular o canal WhatsApp
--     de um tenant a uma pipeline específica.
-- ============================================================================

-- ── 1. start_stage_id na tabela pipelines ─────────────────────────────────────
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS start_stage_id UUID REFERENCES pipeline_stages(id)
    ON DELETE SET NULL;

-- Backfill: usa a primeira etapa de cada pipeline (posição 0)
UPDATE pipelines p
SET    start_stage_id = (
  SELECT id
  FROM   pipeline_stages
  WHERE  pipeline_id = p.id
  ORDER  BY position ASC
  LIMIT  1
)
WHERE  p.start_stage_id IS NULL
  AND  EXISTS (SELECT 1 FROM pipeline_stages WHERE pipeline_id = p.id);

-- ── 2. pipeline_id na tabela whatsapp_settings ────────────────────────────────
ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id)
    ON DELETE SET NULL;

-- Backfill: vincula cada configuração WhatsApp à primeira pipeline do tenant
UPDATE whatsapp_settings ws
SET    pipeline_id = (
  SELECT id
  FROM   pipelines
  WHERE  tenant_id = ws.tenant_id
  ORDER  BY position ASC
  LIMIT  1
)
WHERE  ws.pipeline_id IS NULL;

-- ── 3. Atualiza match_or_create_lead_by_phone para suportar pipeline_id ────────
-- Quando p_pipeline_id for fornecido usa start_stage_id dessa pipeline;
-- caso contrário mantém o comportamento anterior (p_stage_id ou position=0).
CREATE OR REPLACE FUNCTION match_or_create_lead_by_phone(
  p_tenant_id    uuid,
  p_phone        text,
  p_name         text,
  p_channel_id   uuid    DEFAULT NULL,
  p_stage_id     uuid    DEFAULT NULL,
  p_pipeline_id  uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id       uuid;
  v_is_new        boolean := false;
  v_normalized    text;
  v_stage_id      uuid;
  v_existing_card uuid;
  v_card_count    int;
BEGIN
  v_normalized := normalize_phone(p_phone);
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'Phone vazio ou inválido';
  END IF;

  -- ── Resolve a etapa de destino ─────────────────────────────────────────────
  -- Prioridade: pipeline_id.start_stage_id > p_stage_id > primeira etapa do tenant
  IF p_pipeline_id IS NOT NULL THEN
    SELECT start_stage_id INTO v_stage_id
    FROM   pipelines
    WHERE  id = p_pipeline_id AND tenant_id = p_tenant_id;
  END IF;

  IF v_stage_id IS NULL AND p_stage_id IS NOT NULL THEN
    v_stage_id := p_stage_id;
  END IF;

  IF v_stage_id IS NULL THEN
    SELECT id INTO v_stage_id
    FROM   pipeline_stages
    WHERE  tenant_id = p_tenant_id
    ORDER  BY position ASC
    LIMIT  1;
  END IF;

  -- ── Match ou cria lead ─────────────────────────────────────────────────────
  SELECT id INTO v_lead_id
  FROM   leads
  WHERE  tenant_id = p_tenant_id
    AND  normalize_phone(phone) = v_normalized
  ORDER  BY updated_at DESC
  LIMIT  1;

  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      tenant_id, name, phone, status, source, channel_id,
      assigned_to, tags, custom_fields
    ) VALUES (
      p_tenant_id,
      COALESCE(NULLIF(p_name, ''), 'Lead WhatsApp'),
      p_phone,
      'active',
      'other',
      p_channel_id,
      NULL,
      '{}',
      '{}'
    )
    RETURNING id INTO v_lead_id;
    v_is_new := true;
  END IF;

  -- ── Garante que o lead está no pipeline ────────────────────────────────────
  SELECT id INTO v_existing_card
  FROM   pipeline_cards
  WHERE  lead_id = v_lead_id
  LIMIT  1;

  IF v_existing_card IS NULL AND v_stage_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_card_count
    FROM   pipeline_cards
    WHERE  stage_id = v_stage_id;

    INSERT INTO pipeline_cards (tenant_id, lead_id, stage_id, position, moved_at)
    VALUES (p_tenant_id, v_lead_id, v_stage_id, v_card_count, now());
  END IF;

  RETURN json_build_object(
    'lead_id', v_lead_id,
    'is_new',  v_is_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION match_or_create_lead_by_phone(uuid, text, text, uuid, uuid, uuid)
  TO authenticated, anon;
