-- ============================================================================
-- Custom Fields System
-- Tabela de definições + RPCs + seed dos 4 campos padrão
-- ============================================================================

-- 1. Tabela de definições de campos personalizados
CREATE TABLE IF NOT EXISTS lead_field_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label       text NOT NULL,
  field_key   text NOT NULL,
  field_type  text NOT NULL CHECK (field_type IN ('text','number','boolean','select','textarea')),
  options     jsonb DEFAULT NULL,
  required    boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  position    int NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_field_defs_tenant
  ON lead_field_definitions (tenant_id, active, position);

-- 2. RLS
ALTER TABLE lead_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_see_lead_fields" ON lead_field_definitions;
CREATE POLICY "tenant_members_see_lead_fields" ON lead_field_definitions
  FOR SELECT USING (is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant_managers_manage_lead_fields" ON lead_field_definitions;
CREATE POLICY "tenant_managers_manage_lead_fields" ON lead_field_definitions
  FOR ALL
  USING (is_tenant_manager(tenant_id))
  WITH CHECK (is_tenant_manager(tenant_id));

-- 3. RPC: lista todos campos (ativos + inativos) — para gestão
CREATE OR REPLACE FUNCTION get_lead_field_definitions(p_tenant_id uuid)
RETURNS TABLE (
  id              uuid,
  label           text,
  field_key       text,
  field_type      text,
  options         jsonb,
  required        boolean,
  active          boolean,
  field_position  int,
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
    lfd.id              AS id,
    lfd.label           AS label,
    lfd.field_key       AS field_key,
    lfd.field_type      AS field_type,
    lfd.options         AS options,
    lfd.required        AS required,
    lfd.active          AS active,
    lfd.position        AS field_position,
    lfd.created_at      AS created_at
  FROM lead_field_definitions lfd
  WHERE lfd.tenant_id = p_tenant_id
  ORDER BY lfd.position ASC, lfd.created_at ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_lead_field_definitions(uuid) TO authenticated;

-- 4. RPC: reorder atômico (recebe array de {id, position})
CREATE OR REPLACE FUNCTION reorder_lead_field_definitions(
  p_tenant_id uuid,
  p_updates   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF NOT is_tenant_manager(p_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE lead_field_definitions
    SET position = (v_item->>'position')::int
    WHERE id = (v_item->>'id')::uuid
      AND tenant_id = p_tenant_id;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION reorder_lead_field_definitions(uuid, jsonb) TO authenticated;

-- 5. Seed: cria os 4 campos padrão pra cada tenant existente
INSERT INTO lead_field_definitions (tenant_id, label, field_key, field_type, required, position)
SELECT t.id, 'Qual é a sua especialidade principal?', 'especialidade_principal', 'text', false, 0
FROM tenants t
ON CONFLICT (tenant_id, field_key) DO NOTHING;

INSERT INTO lead_field_definitions (tenant_id, label, field_key, field_type, required, position)
SELECT t.id, 'Quantos procedimentos de alto ticket você realiza por mês?',
       'procedimentos_alto_ticket_mes', 'number', false, 1
FROM tenants t
ON CONFLICT (tenant_id, field_key) DO NOTHING;

INSERT INTO lead_field_definitions (tenant_id, label, field_key, field_type, required, position)
SELECT t.id, 'Qual é o seu maior desafio hoje?', 'maior_desafio', 'textarea', false, 2
FROM tenants t
ON CONFLICT (tenant_id, field_key) DO NOTHING;

INSERT INTO lead_field_definitions (tenant_id, label, field_key, field_type, required, position)
SELECT t.id, 'Você já investiu em marketing digital antes?',
       'investiu_marketing_digital', 'boolean', false, 3
FROM tenants t
ON CONFLICT (tenant_id, field_key) DO NOTHING;

-- 6. Trigger: ao criar novo tenant, semeia os 4 campos padrão
CREATE OR REPLACE FUNCTION seed_default_lead_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_field_definitions (tenant_id, label, field_key, field_type, required, position) VALUES
    (NEW.id, 'Qual é a sua especialidade principal?', 'especialidade_principal', 'text', false, 0),
    (NEW.id, 'Quantos procedimentos de alto ticket você realiza por mês?', 'procedimentos_alto_ticket_mes', 'number', false, 1),
    (NEW.id, 'Qual é o seu maior desafio hoje?', 'maior_desafio', 'textarea', false, 2),
    (NEW.id, 'Você já investiu em marketing digital antes?', 'investiu_marketing_digital', 'boolean', false, 3)
  ON CONFLICT (tenant_id, field_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_seed_default_lead_fields ON tenants;
CREATE TRIGGER trigger_seed_default_lead_fields
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION seed_default_lead_fields();
