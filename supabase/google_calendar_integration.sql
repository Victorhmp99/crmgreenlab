-- ============================================================================
-- INTEGRAÇÃO COM GOOGLE CALENDAR (1 calendário por tenant)
-- Tarefas do CRM viram eventos no Google Calendar via Edge Functions.
-- ============================================================================

-- ── 1. Tabela de integração por tenant ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_calendar_integrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  provider           text NOT NULL DEFAULT 'google',
  refresh_token      text NOT NULL,
  access_token       text,
  token_expires_at   timestamptz,
  calendar_id        text NOT NULL,
  calendar_name      text NOT NULL,
  google_email       text,
  connected_by       uuid REFERENCES auth.users(id),
  connected_at       timestamptz NOT NULL DEFAULT now(),
  last_sync_at       timestamptz,
  last_sync_error    text,
  active             boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_integ_tenant ON tenant_calendar_integrations (tenant_id);

CREATE OR REPLACE FUNCTION trg_calendar_integ_updated()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS calendar_integ_updated_at ON tenant_calendar_integrations;
CREATE TRIGGER calendar_integ_updated_at
  BEFORE UPDATE ON tenant_calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION trg_calendar_integ_updated();

-- RLS: só admin/manager do tenant ou super admin vê/gerencia
ALTER TABLE tenant_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_integ_select" ON tenant_calendar_integrations;
DROP POLICY IF EXISTS "calendar_integ_write"  ON tenant_calendar_integrations;
DROP POLICY IF EXISTS "calendar_integ_update" ON tenant_calendar_integrations;
DROP POLICY IF EXISTS "calendar_integ_delete" ON tenant_calendar_integrations;

CREATE POLICY "calendar_integ_select" ON tenant_calendar_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_calendar_integrations.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY "calendar_integ_write" ON tenant_calendar_integrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_calendar_integrations.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "calendar_integ_update" ON tenant_calendar_integrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_calendar_integrations.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "calendar_integ_delete" ON tenant_calendar_integrations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_memberships m
       WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_calendar_integrations.tenant_id
         AND m.active = true AND m.role IN ('admin', 'manager')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_calendar_integrations TO authenticated;

-- ── 2. Campos extras em lead_tasks ─────────────────────────────────────────

ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS external_event_id  text,
  ADD COLUMN IF NOT EXISTS external_provider  text,
  ADD COLUMN IF NOT EXISTS synced_at          timestamptz,
  ADD COLUMN IF NOT EXISTS duration_minutes   int  NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS attendee_emails    text[] DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_tasks_external_event
  ON lead_tasks (external_event_id) WHERE external_event_id IS NOT NULL;

-- ── 3. View pública (segura): integração sem o refresh_token ───────────────
-- Útil pro frontend mostrar status sem expor o token.
CREATE OR REPLACE VIEW tenant_calendar_status AS
SELECT
  id, tenant_id, provider, calendar_id, calendar_name, google_email,
  connected_by, connected_at, last_sync_at, last_sync_error, active, updated_at
FROM tenant_calendar_integrations;

GRANT SELECT ON tenant_calendar_status TO authenticated;
