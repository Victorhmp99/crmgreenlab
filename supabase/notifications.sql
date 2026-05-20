-- ============================================================================
-- NOTIFICATIONS — Super Admin Master envia avisos pros usuários do CRM.
-- Cada linha = 1 notificação pra 1 destinatário.
-- Pra enviar pra múltiplos usuários: o frontend chama o RPC com array de IDs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,  -- opcional (master pode mandar p/ usuario sem tenant)
  recipient_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id),
  title           text NOT NULL,
  body            text NOT NULL,
  link            text,                       -- URL opcional ao clicar
  read_at         timestamptz,                -- NULL = não lida
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, read_at, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_recipient_select" ON notifications;
DROP POLICY IF EXISTS "notif_master_insert"    ON notifications;
DROP POLICY IF EXISTS "notif_recipient_update" ON notifications;
DROP POLICY IF EXISTS "notif_recipient_delete" ON notifications;

-- SELECT: destinatário vê só as suas. Super admin (master + auxiliary) vê todas.
CREATE POLICY "notif_recipient_select" ON notifications
  FOR SELECT USING (
    recipient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

-- INSERT: somente super admin (master ou auxiliary) pode criar
CREATE POLICY "notif_master_insert" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

-- UPDATE: destinatário pode marcar como lida. Super admin não precisa editar.
CREATE POLICY "notif_recipient_update" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- DELETE: destinatário pode limpar a própria. Super admin pode limpar qualquer uma.
CREATE POLICY "notif_recipient_delete" ON notifications
  FOR DELETE USING (
    recipient_id = auth.uid()
    OR EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- ── RPC: enviar notificação pra um ou mais usuários ─────────────────────────
CREATE OR REPLACE FUNCTION send_notification(
  p_recipient_ids uuid[],
  p_title         text,
  p_body          text,
  p_link          text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  int  := 0;
  v_id     uuid;
BEGIN
  -- Permissão: somente super admin
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = v_caller) THEN
    RAISE EXCEPTION 'Sem permissão. Apenas Super Admin pode enviar notificações.';
  END IF;

  IF p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de destinatários vazia';
  END IF;

  FOREACH v_id IN ARRAY p_recipient_ids LOOP
    INSERT INTO notifications (recipient_id, created_by, title, body, link, tenant_id)
    SELECT v_id, v_caller, p_title, p_body, p_link, m.tenant_id
      FROM user_memberships m
     WHERE m.user_id = v_id AND m.active = true
     LIMIT 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION send_notification(uuid[], text, text, text) TO authenticated;

-- ── RPC: broadcast pra todos os usuários ativos (apenas super admin master) ─
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_title text,
  p_body  text,
  p_link  text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count  int;
BEGIN
  -- Somente master pode broadcast global
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
     WHERE sa.user_id = v_caller AND sa.type = 'master'
  ) THEN
    RAISE EXCEPTION 'Sem permissão. Apenas Super Admin Master pode fazer broadcast.';
  END IF;

  INSERT INTO notifications (recipient_id, created_by, title, body, link, tenant_id)
  SELECT m.user_id, v_caller, p_title, p_body, p_link, m.tenant_id
    FROM user_memberships m
   WHERE m.active = true
     AND m.user_id != v_caller;  -- não envia pra si mesmo

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION broadcast_notification(text, text, text) TO authenticated;
