-- ============================================================================
-- MULTI-EMPRESA: funções para criar empresa e obter informações do tenant
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================================

-- ── 1. RPC: criar empresa para o usuário logado ──────────────────────────────
--
-- Qualquer usuário com role admin ou manager pode chamar esta função.
-- Ela cria o tenant + membership (como admin) + tenant_settings em uma
-- transação atômica via SECURITY DEFINER (bypassa RLS).
--
CREATE OR REPLACE FUNCTION create_tenant_for_user(
  p_name text,
  p_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_membership user_memberships%ROWTYPE;
  v_role       user_role;
  v_tenant_id  uuid;
BEGIN
  -- Somente usuários autenticados podem criar empresas
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: login required';
  END IF;

  -- Verifica se o usuário tem role admin ou manager em QUALQUER tenant
  SELECT role INTO v_role
  FROM user_memberships
  WHERE user_id = v_user_id
    AND active = true
    AND role IN ('admin', 'manager')
  LIMIT 1;

  -- Super admins também podem criar tenants
  IF v_role IS NULL AND NOT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin or manager role required';
  END IF;

  -- Valida slug
  IF p_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'Slug inválido: use apenas letras minúsculas, números e hífens';
  END IF;

  -- Cria o tenant
  INSERT INTO tenants (name, slug, plan, active)
  VALUES (p_name, p_slug, 'trial', true)
  RETURNING id INTO v_tenant_id;

  -- Cria membership do criador como admin
  INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
  VALUES (v_user_id, v_tenant_id, 'admin', true, 'active')
  RETURNING * INTO v_membership;

  -- Cria configurações padrão do tenant
  INSERT INTO tenant_settings (tenant_id, primary_color, secondary_color)
  VALUES (v_tenant_id, '#00e676', '#00b248')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Retorna tenant + membership criados
  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id',         v_tenant_id,
      'name',       p_name,
      'slug',       p_slug,
      'plan',       'trial',
      'active',     true,
      'created_at', now()
    ),
    'membership', jsonb_build_object(
      'id',                 v_membership.id,
      'user_id',            v_user_id,
      'tenant_id',          v_tenant_id,
      'role',               'admin',
      'active',             true,
      'account_status',     'active',
      'status_changed_by',  null,
      'status_changed_at',  null,
      'created_at',         v_membership.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_tenant_for_user(text, text) TO authenticated;


-- ── 2. RPC: obter todos os tenants do usuário logado (para o switcher) ────────
--
-- Retorna todos os tenants ativos onde o usuário tem membership ativa.
-- Usado para popular availableTenants no AuthStore ao fazer login.
--
CREATE OR REPLACE FUNCTION get_my_tenants()
RETURNS TABLE (
  tenant_id       uuid,
  tenant_name     text,
  tenant_slug     text,
  tenant_plan     text,
  tenant_active   boolean,
  tenant_created  timestamptz,
  membership_id   uuid,
  user_role       user_role,
  account_status  account_status,
  joined_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.active,
    t.created_at,
    um.id,
    um.role,
    um.account_status,
    um.created_at
  FROM user_memberships um
  JOIN tenants t ON t.id = um.tenant_id
  WHERE um.user_id = auth.uid()
    AND um.active  = true
    AND t.active   = true
  ORDER BY um.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_tenants() TO authenticated;


-- ── 3. Melhoria no accept_invite: valida email do convite ────────────────────
--
-- Substitui a versão anterior adicionando verificação de email.
-- Se o usuário logado não tem o mesmo email do convite, rejeita.
-- Isso evita que alguém aceite um convite que não era para ele.
--
CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite   tenant_invites%ROWTYPE;
  v_user_id  uuid := auth.uid();
  v_email    text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Login necessário para aceitar o convite.');
  END IF;

  -- Busca email do usuário logado em auth.users via perfil
  SELECT email INTO v_email FROM profiles WHERE id = v_user_id;

  -- Busca convite válido
  SELECT * INTO v_invite
  FROM tenant_invites
  WHERE token      = p_token
    AND accepted_at IS NULL
    AND expires_at  > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Convite inválido ou expirado.');
  END IF;

  -- Valida que o email do convite corresponde ao usuário logado
  -- (case-insensitive para evitar problemas de capitalização)
  IF lower(v_invite.email) <> lower(v_email) THEN
    RETURN jsonb_build_object('error', 'Este convite é para outro endereço de e-mail.');
  END IF;

  -- Cria ou reativa membership (ON CONFLICT garante idempotência)
  INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
  VALUES (v_user_id, v_invite.tenant_id, v_invite.role, true, 'active')
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET role           = excluded.role,
        active         = true,
        account_status = 'active';

  -- Marca convite como aceito
  UPDATE tenant_invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success',   true,
    'tenant_id', v_invite.tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invite(text) TO authenticated;


-- ── 4. Unique constraint em user_memberships ─────────────────────────────────
--
-- Garante que a combinação user_id + tenant_id é única.
-- ON CONFLICT nas funções acima depende desta constraint.
-- (seguro rodar mesmo se já existir — o IF NOT EXISTS no nome evita erro)
--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_memberships_user_tenant_unique'
  ) THEN
    ALTER TABLE user_memberships
      ADD CONSTRAINT user_memberships_user_tenant_unique
      UNIQUE (user_id, tenant_id);
  END IF;
END;
$$;
