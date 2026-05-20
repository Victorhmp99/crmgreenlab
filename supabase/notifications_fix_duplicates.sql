-- ============================================================================
-- FIX: notificações duplicadas + recebimento pelo próprio remetente.
-- Causa: get_platform_users retorna 1 linha por membership (usuário com vários
-- tenants aparece N vezes). RPCs estavam criando N notificações por usuário.
-- ============================================================================

-- ── send_notification: desduplica recipient_ids ────────────────────────────
DROP FUNCTION IF EXISTS send_notification(uuid[], text, text, text);

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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = v_caller) THEN
    RAISE EXCEPTION 'Sem permissão. Apenas Super Admin pode enviar notificações.';
  END IF;

  IF p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de destinatários vazia';
  END IF;

  -- 1 INSERT por usuário ÚNICO (DISTINCT), pegando 1 tenant_id de qualquer membership ativa
  WITH unique_recipients AS (
    SELECT DISTINCT id AS user_id
      FROM unnest(p_recipient_ids) AS id
     WHERE id != v_caller  -- não envia pra si mesmo
  )
  INSERT INTO notifications (recipient_id, created_by, title, body, link, tenant_id)
  SELECT
    ur.user_id,
    v_caller,
    p_title,
    p_body,
    p_link,
    (SELECT m.tenant_id FROM user_memberships m
       WHERE m.user_id = ur.user_id AND m.active = true
       LIMIT 1)
  FROM unique_recipients ur;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION send_notification(uuid[], text, text, text) TO authenticated;

-- ── broadcast_notification: desduplica usuários com múltiplas memberships ───
DROP FUNCTION IF EXISTS broadcast_notification(text, text, text);

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
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
     WHERE sa.user_id = v_caller AND sa.type = 'master'
  ) THEN
    RAISE EXCEPTION 'Sem permissão. Apenas Super Admin Master pode fazer broadcast.';
  END IF;

  -- DISTINCT ON (user_id) garante 1 notificação por usuário,
  -- mesmo que ele tenha memberships em vários tenants
  INSERT INTO notifications (recipient_id, created_by, title, body, link, tenant_id)
  SELECT DISTINCT ON (m.user_id) m.user_id, v_caller, p_title, p_body, p_link, m.tenant_id
    FROM user_memberships m
   WHERE m.active = true
     AND m.user_id != v_caller;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION broadcast_notification(text, text, text) TO authenticated;
