-- ================================================================
-- Sistema de status de conta + hierarquia completa de Super Admin
-- Execute no SQL Editor do Supabase
-- ================================================================

-- 1. account_status em user_memberships
--    Existentes ficam 'active'. Novos cadastros entrarão como 'pending'.
ALTER TABLE user_memberships
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('pending', 'active', 'blocked'));

ALTER TABLE user_memberships
  ADD COLUMN IF NOT EXISTS status_changed_by uuid DEFAULT NULL;

ALTER TABLE user_memberships
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT NULL;

-- 2. Tipo de super admin (master ou auxiliary)
ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'master'
  CHECK (type IN ('master', 'auxiliary'));

-- Garante que o super admin existente seja master
UPDATE super_admins SET type = 'master';

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- 3. Lista todos os usuários de todos os tenants (plataforma)
CREATE OR REPLACE FUNCTION get_platform_users()
RETURNS TABLE (
  membership_id     uuid,
  user_id           uuid,
  tenant_id         uuid,
  tenant_name       text,
  email             text,
  full_name         text,
  role              text,
  account_status    text,
  is_super_admin    boolean,
  super_admin_type  text,
  joined_at         timestamptz,
  status_changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.tenant_id,
    t.name,
    p.email,
    p.full_name,
    m.role::text,
    m.account_status,
    (sa.user_id IS NOT NULL),
    sa.type,
    m.created_at,
    m.status_changed_at
  FROM user_memberships m
  JOIN   tenants      t  ON t.id  = m.tenant_id
  LEFT JOIN profiles  p  ON p.id  = m.user_id
  LEFT JOIN super_admins sa ON sa.user_id = m.user_id
  ORDER BY m.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_users() TO authenticated;

-- 4. Ativa, bloqueia ou coloca em pendente qualquer conta
CREATE OR REPLACE FUNCTION set_account_status(
  p_membership_id uuid,
  p_status        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('pending', 'active', 'blocked') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  SELECT user_id INTO v_target_user_id
  FROM user_memberships WHERE id = p_membership_id;

  -- Auxiliar não pode agir sobre outros super admins
  IF EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND type = 'auxiliary')
  AND EXISTS (SELECT 1 FROM super_admins WHERE user_id = v_target_user_id) THEN
    RAISE EXCEPTION 'Super Admin Auxiliar não pode agir sobre outros Super Admins';
  END IF;

  UPDATE user_memberships
  SET
    account_status    = p_status,
    status_changed_by = auth.uid(),
    status_changed_at = now()
  WHERE id = p_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_account_status(uuid, text) TO authenticated;

-- 5. Altera o role de qualquer usuário (a partir do painel da plataforma)
CREATE OR REPLACE FUNCTION set_platform_user_role(
  p_membership_id uuid,
  p_role          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_role NOT IN ('seller', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END IF;

  UPDATE user_memberships
  SET role = p_role::user_role
  WHERE id = p_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_platform_user_role(uuid, text) TO authenticated;

-- 6. Concede acesso de Super Admin Auxiliar (somente master pode)
CREATE OR REPLACE FUNCTION grant_super_admin_auxiliary(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND type = 'master'
  ) THEN
    RAISE EXCEPTION 'Somente o Super Admin Master pode conceder este acesso';
  END IF;

  INSERT INTO super_admins (user_id, type)
  VALUES (p_user_id, 'auxiliary')
  ON CONFLICT (user_id) DO UPDATE SET type = 'auxiliary';
END;
$$;

GRANT EXECUTE ON FUNCTION grant_super_admin_auxiliary(uuid) TO authenticated;

-- 7. Revoga acesso de Super Admin Auxiliar (somente master pode)
CREATE OR REPLACE FUNCTION revoke_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND type = 'master'
  ) THEN
    RAISE EXCEPTION 'Somente o Super Admin Master pode revogar este acesso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = p_user_id AND type = 'master'
  ) THEN
    RAISE EXCEPTION 'Não é possível revogar o acesso do Super Admin Master';
  END IF;

  DELETE FROM super_admins WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_super_admin(uuid) TO authenticated;

-- 8. Recria accept_invite garantindo account_status = 'active' para convidados
DROP FUNCTION IF EXISTS accept_invite(text);
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  tenant_invites%ROWTYPE;
  v_uid     uuid := auth.uid();
BEGIN
  SELECT * INTO v_invite
  FROM tenant_invites
  WHERE token       = p_token
    AND accepted_at IS NULL
    AND expires_at  > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Convite inválido ou expirado');
  END IF;

  -- Convites sempre entram como 'active', sem precisar de aprovação
  INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
  VALUES (v_uid, v_invite.tenant_id, v_invite.role, true, 'active');

  UPDATE tenant_invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN json_build_object('tenant_id', v_invite.tenant_id);
EXCEPTION WHEN unique_violation THEN
  -- Usuário já era membro — apenas atualiza
  UPDATE user_memberships
  SET role = v_invite.role, active = true, account_status = 'active'
  WHERE user_id = v_uid AND tenant_id = v_invite.tenant_id;

  UPDATE tenant_invites SET accepted_at = now() WHERE id = v_invite.id;
  RETURN json_build_object('tenant_id', v_invite.tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invite(text) TO authenticated, anon;
