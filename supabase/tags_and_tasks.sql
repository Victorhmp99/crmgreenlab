-- ============================================================================
-- TAGS REUTILIZÁVEIS COM COR + TAREFAS
-- 1a) tags antigas (leads.tags[] string) continuam sendo populadas pra compat
-- 2) tarefas: todos veem e criam, só admin/manager atribui a outros
-- ============================================================================

-- ── 1. Tabelas de TAGS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_tag_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#888888',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tag_defs_tenant ON lead_tag_definitions (tenant_id);

CREATE TABLE IF NOT EXISTS lead_tag_links (
  lead_id     uuid NOT NULL REFERENCES leads(id)                 ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES lead_tag_definitions(id)  ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id)               ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_links_lead   ON lead_tag_links (lead_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_tenant ON lead_tag_links (tenant_id);

-- RLS de tags
ALTER TABLE lead_tag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tag_links       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_def_select" ON lead_tag_definitions;
DROP POLICY IF EXISTS "tag_def_write"  ON lead_tag_definitions;
DROP POLICY IF EXISTS "tag_def_update" ON lead_tag_definitions;
DROP POLICY IF EXISTS "tag_def_delete" ON lead_tag_definitions;

CREATE POLICY "tag_def_select" ON lead_tag_definitions
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY "tag_def_write" ON lead_tag_definitions
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
  );

CREATE POLICY "tag_def_update" ON lead_tag_definitions
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
  );

CREATE POLICY "tag_def_delete" ON lead_tag_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = lead_tag_definitions.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tag_link_select" ON lead_tag_links;
DROP POLICY IF EXISTS "tag_link_write"  ON lead_tag_links;
DROP POLICY IF EXISTS "tag_link_delete" ON lead_tag_links;

CREATE POLICY "tag_link_select" ON lead_tag_links
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY "tag_link_write" ON lead_tag_links
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
  );

CREATE POLICY "tag_link_delete" ON lead_tag_links
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON lead_tag_definitions TO authenticated;
GRANT SELECT, INSERT,         DELETE ON lead_tag_links       TO authenticated;

-- ── 2. Migração: leads.tags[] (strings) → lead_tag_definitions + links ─────

DO $$
DECLARE
  lead_rec    RECORD;
  tag_name    text;
  v_tag_id    uuid;
BEGIN
  FOR lead_rec IN SELECT id, tenant_id, tags FROM leads WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 LOOP
    FOREACH tag_name IN ARRAY lead_rec.tags LOOP
      IF trim(tag_name) = '' THEN CONTINUE; END IF;
      -- upsert def por (tenant_id, name)
      INSERT INTO lead_tag_definitions (tenant_id, name, color)
      VALUES (lead_rec.tenant_id, trim(tag_name), '#888888')
      ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_tag_id;

      -- link idempotente
      INSERT INTO lead_tag_links (lead_id, tag_id, tenant_id)
      VALUES (lead_rec.id, v_tag_id, lead_rec.tenant_id)
      ON CONFLICT (lead_id, tag_id) DO NOTHING;
    END LOOP;
  END LOOP;
END$$;

-- ── 3. RPC: sincronizar tags de um lead (recebe array de tag_ids) ──────────
-- Garante: limpa links antigos, insere novos, atualiza leads.tags[] (compat)

CREATE OR REPLACE FUNCTION sync_lead_tags(p_lead_id uuid, p_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_names     text[];
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM leads WHERE id = p_lead_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  -- Verifica acesso ao tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships
     WHERE user_id = auth.uid() AND tenant_id = v_tenant_id AND active = true
  ) AND NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- Remove links que não estão na nova lista
  DELETE FROM lead_tag_links WHERE lead_id = p_lead_id
    AND (p_tag_ids IS NULL OR tag_id != ALL(p_tag_ids));

  -- Adiciona novos links
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO lead_tag_links (lead_id, tag_id, tenant_id)
    SELECT p_lead_id, unnest(p_tag_ids), v_tenant_id
    ON CONFLICT (lead_id, tag_id) DO NOTHING;
  END IF;

  -- Compat: atualiza leads.tags[] (string array) com nomes das tags
  SELECT COALESCE(array_agg(td.name ORDER BY td.name), ARRAY[]::text[])
    INTO v_names
    FROM lead_tag_links ll
    JOIN lead_tag_definitions td ON td.id = ll.tag_id
   WHERE ll.lead_id = p_lead_id;

  UPDATE leads SET tags = v_names, updated_at = now() WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_lead_tags(uuid, uuid[]) TO authenticated;

-- ── 4. Tabela de TAREFAS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,  -- opcional
  created_by    uuid REFERENCES auth.users(id),
  assigned_to   uuid REFERENCES auth.users(id),
  title         text NOT NULL,
  description   text,
  due_at        timestamptz NOT NULL,
  completed     boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due  ON lead_tasks (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_lead        ON lead_tasks (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned    ON lead_tasks (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE OR REPLACE FUNCTION trg_lead_tasks_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS lead_tasks_updated_at ON lead_tasks;
CREATE TRIGGER lead_tasks_updated_at
  BEFORE UPDATE ON lead_tasks
  FOR EACH ROW EXECUTE FUNCTION trg_lead_tasks_updated();

-- RLS de tarefas
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_select" ON lead_tasks;
DROP POLICY IF EXISTS "task_insert" ON lead_tasks;
DROP POLICY IF EXISTS "task_update" ON lead_tasks;
DROP POLICY IF EXISTS "task_delete" ON lead_tasks;

-- SELECT: TODOS membros ativos do tenant veem
CREATE POLICY "task_select" ON lead_tasks
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

-- INSERT: membro pode criar. Atribuição:
--   - assigned_to = NULL (sem atribuição) → qualquer membro
--   - assigned_to = auth.uid() (auto-atribuir) → qualquer membro
--   - assigned_to = outro usuário → SÓ admin/manager
CREATE POLICY "task_insert" ON lead_tasks
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
    AND (
      assigned_to IS NULL
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_memberships m
         WHERE m.user_id = auth.uid() AND m.tenant_id = lead_tasks.tenant_id
           AND m.active = true AND m.role IN ('admin', 'manager')
      )
      OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    )
  );

-- UPDATE: criador, responsável, admin/manager, super admin
-- WITH CHECK aplica a mesma regra de atribuição (não pode mudar pra outro a não ser que seja admin)
CREATE POLICY "task_update" ON lead_tasks
  FOR UPDATE USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = lead_tasks.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_memberships WHERE user_id = auth.uid() AND active = true)
    AND (
      assigned_to IS NULL
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_memberships m
         WHERE m.user_id = auth.uid() AND m.tenant_id = lead_tasks.tenant_id
           AND m.active = true AND m.role IN ('admin', 'manager')
      )
      OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    )
  );

-- DELETE: criador, admin/manager, super admin
CREATE POLICY "task_delete" ON lead_tasks
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = lead_tasks.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON lead_tasks TO authenticated;
