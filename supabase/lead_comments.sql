-- ============================================================================
-- LEAD_COMMENTS — comentários (separados dos disparos)
-- Diferença pro lead_activities: editáveis, sem afetar relatórios/funil.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_created
  ON lead_comments (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_comments_tenant
  ON lead_comments (tenant_id);

-- Trigger: atualiza updated_at no UPDATE
CREATE OR REPLACE FUNCTION trg_lead_comments_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_comments_updated_at ON lead_comments;
CREATE TRIGGER lead_comments_updated_at
  BEFORE UPDATE ON lead_comments
  FOR EACH ROW EXECUTE FUNCTION trg_lead_comments_set_updated_at();

-- RLS
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_see_comments"    ON lead_comments;
DROP POLICY IF EXISTS "tenant_members_create_comments" ON lead_comments;
DROP POLICY IF EXISTS "comment_author_update"          ON lead_comments;
DROP POLICY IF EXISTS "comment_delete_rules"           ON lead_comments;

-- SELECT: qualquer membro ativo do tenant
CREATE POLICY "tenant_members_see_comments" ON lead_comments
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND active = true
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

-- INSERT: membro ativo do tenant
CREATE POLICY "tenant_members_create_comments" ON lead_comments
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND active = true
    )
  );

-- UPDATE: apenas o autor pode editar o próprio
CREATE POLICY "comment_author_update" ON lead_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: autor, admin/manager do tenant, ou super admin
CREATE POLICY "comment_delete_rules" ON lead_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id   = auth.uid()
         AND m.tenant_id = lead_comments.tenant_id
         AND m.active    = true
         AND m.role IN ('admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON lead_comments TO authenticated;
