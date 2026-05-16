-- ============================================================================
-- WhatsApp Inbound Integration (Evolution API)
-- ============================================================================

-- 1. Tabela de configuração por tenant
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  evolution_url       text,
  instance_name       text,
  default_stage_id    uuid REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  default_channel_id  uuid REFERENCES lead_channels(id) ON DELETE SET NULL,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_token
  ON whatsapp_settings (webhook_token) WHERE active = true;

-- 2. RLS
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_see_whatsapp" ON whatsapp_settings;
CREATE POLICY "tenant_members_see_whatsapp" ON whatsapp_settings
  FOR SELECT USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant_managers_manage_whatsapp" ON whatsapp_settings;
CREATE POLICY "tenant_managers_manage_whatsapp" ON whatsapp_settings
  FOR ALL
  USING (is_tenant_manager(tenant_id))
  WITH CHECK (is_tenant_manager(tenant_id));

-- 3. Função: normaliza phone (mantém só dígitos)
CREATE OR REPLACE FUNCTION normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
$$;

-- 4. Índice por telefone normalizado (acelera busca)
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized
  ON leads (tenant_id, normalize_phone(phone))
  WHERE phone IS NOT NULL;

-- 5. Adiciona campo opcional para dedupe de mensagens
ALTER TABLE lead_activities
  ADD COLUMN IF NOT EXISTS external_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_activities_external_id
  ON lead_activities (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- 6. RPC: encontra ou cria lead por telefone (chamado pelo webhook)
CREATE OR REPLACE FUNCTION match_or_create_lead_by_phone(
  p_tenant_id    uuid,
  p_phone        text,
  p_name         text,
  p_channel_id   uuid DEFAULT NULL,
  p_stage_id     uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id      uuid;
  v_is_new       boolean := false;
  v_normalized   text;
  v_stage_id     uuid;
  v_card_count   int;
  v_existing_card uuid;
BEGIN
  v_normalized := normalize_phone(p_phone);
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'Phone vazio ou inválido';
  END IF;

  -- Busca lead existente (último atualizado primeiro)
  SELECT id INTO v_lead_id
  FROM leads
  WHERE tenant_id = p_tenant_id
    AND normalize_phone(phone) = v_normalized
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    -- Cria novo lead (assigned_to=null → toda equipe vê)
    INSERT INTO leads (
      tenant_id, name, phone, status, source, channel_id,
      assigned_to, tags, custom_fields
    ) VALUES (
      p_tenant_id,
      COALESCE(NULLIF(p_name, ''), 'Lead WhatsApp'),
      p_phone,
      'active',
      'other',           -- source 'other' p/ WhatsApp; channel é mais específico
      p_channel_id,
      NULL,
      '{}',
      '{}'
    )
    RETURNING id INTO v_lead_id;
    v_is_new := true;
  END IF;

  -- Garante que o lead está no pipeline
  -- Se não tiver stage_id configurado, pega a primeira etapa do tenant
  IF p_stage_id IS NOT NULL THEN
    v_stage_id := p_stage_id;
  ELSE
    SELECT id INTO v_stage_id
    FROM pipeline_stages
    WHERE tenant_id = p_tenant_id
    ORDER BY position ASC
    LIMIT 1;
  END IF;

  -- Verifica se já está no pipeline
  SELECT id INTO v_existing_card
  FROM pipeline_cards
  WHERE lead_id = v_lead_id
  LIMIT 1;

  IF v_existing_card IS NULL AND v_stage_id IS NOT NULL THEN
    -- Calcula próxima position
    SELECT COUNT(*) INTO v_card_count
    FROM pipeline_cards
    WHERE stage_id = v_stage_id;

    INSERT INTO pipeline_cards (tenant_id, lead_id, stage_id, position, moved_at)
    VALUES (p_tenant_id, v_lead_id, v_stage_id, v_card_count, now());
  END IF;

  RETURN json_build_object(
    'lead_id', v_lead_id,
    'is_new',  v_is_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION match_or_create_lead_by_phone(uuid, text, text, uuid, uuid) TO authenticated, anon;

-- 7. RPC: regenera webhook_token (revoga o atual)
CREATE OR REPLACE FUNCTION regenerate_whatsapp_token(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new_token uuid;
BEGIN
  IF NOT is_tenant_manager(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_new_token := gen_random_uuid();

  UPDATE whatsapp_settings
  SET webhook_token = v_new_token, updated_at = now()
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    -- Cria settings se não existia
    INSERT INTO whatsapp_settings (tenant_id, webhook_token)
    VALUES (p_tenant_id, v_new_token);
  END IF;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION regenerate_whatsapp_token(uuid) TO authenticated;

-- 8. Trigger: cria settings + canal "WhatsApp" automaticamente para tenants novos
CREATE OR REPLACE FUNCTION seed_whatsapp_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_channel_id uuid;
BEGIN
  -- Cria canal WhatsApp se não existir
  INSERT INTO lead_channels (tenant_id, name, color, position)
  VALUES (NEW.id, 'WhatsApp', '#25D366', 100)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_channel_id;

  -- Se já existia, busca
  IF v_channel_id IS NULL THEN
    SELECT id INTO v_channel_id FROM lead_channels
    WHERE tenant_id = NEW.id AND name = 'WhatsApp' LIMIT 1;
  END IF;

  -- Cria settings com canal default
  INSERT INTO whatsapp_settings (tenant_id, default_channel_id)
  VALUES (NEW.id, v_channel_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_whatsapp_settings ON tenants;
CREATE TRIGGER trigger_seed_whatsapp_settings
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION seed_whatsapp_settings();

-- 9. Backfill para tenants existentes (cria canal WhatsApp + settings)
DO $$
DECLARE
  v_tenant RECORD;
  v_channel_id uuid;
BEGIN
  FOR v_tenant IN SELECT id FROM tenants LOOP
    -- Cria canal WhatsApp se não existir
    INSERT INTO lead_channels (tenant_id, name, color, position)
    VALUES (v_tenant.id, 'WhatsApp', '#25D366', 100)
    ON CONFLICT (tenant_id, name) DO NOTHING;

    SELECT id INTO v_channel_id FROM lead_channels
    WHERE tenant_id = v_tenant.id AND name = 'WhatsApp' LIMIT 1;

    -- Cria settings com canal default
    INSERT INTO whatsapp_settings (tenant_id, default_channel_id)
    VALUES (v_tenant.id, v_channel_id)
    ON CONFLICT (tenant_id) DO NOTHING;
  END LOOP;
END;
$$;
