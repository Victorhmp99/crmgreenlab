-- ================================================================
-- Tokens de cadastro pré-aprovado
-- Super Admin gera um link que permite criar conta já ativa
-- ================================================================

CREATE TABLE IF NOT EXISTS signup_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by  uuid NOT NULL,
  used_at     timestamptz DEFAULT NULL,
  used_by     uuid         DEFAULT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signup_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_manage_tokens" ON signup_tokens;
CREATE POLICY "super_admins_manage_tokens"
  ON signup_tokens FOR ALL
  USING (EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()));

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Gera novo token de cadastro (só super admin)
CREATE OR REPLACE FUNCTION create_signup_token()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO signup_tokens (created_by)
  VALUES (auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_signup_token() TO authenticated;

-- Valida e consome o token (callable por anon — chamado durante registro)
CREATE OR REPLACE FUNCTION consume_signup_token(p_token uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM signup_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE signup_tokens
  SET used_at = now(), used_by = p_user_id
  WHERE id = v_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION consume_signup_token(uuid, uuid) TO authenticated, anon;
