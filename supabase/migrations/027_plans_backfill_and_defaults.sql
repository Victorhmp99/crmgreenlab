-- ============================================================================
-- Migration 027 — Backfill de planos + defaults por plano
--
-- • Empresas ativas atuais → melhor plano (Plus) com o pacote completo.
-- • Novas empresas nascem no plano básico (Start): default de features vira
--   só 'automations' e o plano criado passa a ser 'start' (antes 'trial').
-- • Ajusta as 2 funções de criação (create_tenant_for_user,
--   register_new_tenant_with_admin) trocando só o rótulo do plano trial→start;
--   o resto do corpo é idêntico ao anterior.
-- ============================================================================

-- 1) Empresas ativas atuais recebem o MELHOR plano (Plus)
UPDATE tenants
SET plan = 'plus',
    features = ARRAY['automations','financeiro','relatorios','meta_ads','sdr_whatsapp']::text[]
WHERE active = true;

-- 2) Novas empresas nascem no plano básico (Start)
ALTER TABLE tenants ALTER COLUMN features SET DEFAULT ARRAY['automations']::text[];
ALTER TABLE tenants ALTER COLUMN plan     SET DEFAULT 'start';

-- 3) Funções de criação: plano 'trial' → 'start' (corpo idêntico ao atual)
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(p_name text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id      uuid    := auth.uid();
  v_membership   user_memberships%ROWTYPE;
  v_tenant_id    uuid;
  v_final_slug   text;
  v_counter      int     := 1;
  v_owned        int;
  v_limit        int;
  v_is_super     boolean;
  v_create_role  user_role;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Login necessário.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM super_admins WHERE user_id = v_user_id) INTO v_is_super;

  IF v_is_super THEN
    v_create_role := 'admin';
  ELSIF EXISTS(
    SELECT 1 FROM user_memberships
    WHERE user_id = v_user_id AND active = true AND role = 'admin'
  ) THEN
    v_create_role := 'admin';
  ELSIF EXISTS(
    SELECT 1 FROM user_memberships
    WHERE user_id = v_user_id AND active = true AND role = 'manager'
  ) THEN
    v_create_role := 'manager';
  ELSE
    RETURN jsonb_build_object('error', 'Apenas admins e gestores podem criar empresas.');
  END IF;

  SELECT COUNT(*) INTO v_owned
  FROM user_memberships WHERE user_id = v_user_id AND active = true;

  SELECT MIN(max_companies_override) INTO v_limit
  FROM user_memberships
  WHERE user_id = v_user_id AND active = true AND max_companies_override IS NOT NULL;

  IF v_limit IS NOT NULL AND v_owned >= v_limit THEN
    RETURN jsonb_build_object('error', 'limit_reached:' || v_limit::text);
  END IF;

  IF p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('error', 'Slug inválido.');
  END IF;

  v_final_slug := p_slug;
  WHILE EXISTS(SELECT 1 FROM tenants WHERE slug = v_final_slug) LOOP
    v_counter    := v_counter + 1;
    v_final_slug := p_slug || '-' || v_counter;
  END LOOP;

  INSERT INTO tenants (name, slug, plan, active)
  VALUES (p_name, v_final_slug, 'start', true)
  RETURNING id INTO v_tenant_id;

  INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
  VALUES (v_user_id, v_tenant_id, v_create_role, true, 'active')
  RETURNING * INTO v_membership;

  INSERT INTO tenant_settings (tenant_id, primary_color, secondary_color, webhook_key)
  VALUES (v_tenant_id, '#00e676', '#00b248', gen_random_uuid())
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN jsonb_build_object(
    'tenant', jsonb_build_object(
      'id', v_tenant_id, 'name', p_name, 'slug', v_final_slug,
      'plan', 'start', 'active', true, 'created_at', now()
    ),
    'membership', jsonb_build_object(
      'id', v_membership.id, 'user_id', v_user_id, 'tenant_id', v_tenant_id,
      'role', v_create_role::text, 'active', true, 'account_status', 'active',
      'status_changed_by', null, 'status_changed_at', null, 'created_at', v_membership.created_at
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_new_tenant_with_admin(p_user_id uuid, p_company_name text, p_slug text, p_signup_token uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id      uuid;
  v_status         text := 'pending';
  v_token_consumed boolean := false;
  v_token_row      signup_tokens%ROWTYPE;
  v_role           user_role := 'admin';
  v_final_slug     text;
  v_counter        int := 1;
BEGIN
  IF EXISTS (SELECT 1 FROM user_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Este email ja esta cadastrado em uma empresa. Faca login na conta existente.';
  END IF;

  IF p_signup_token IS NOT NULL THEN
    SELECT * INTO v_token_row
    FROM signup_tokens
    WHERE token = p_signup_token AND used_at IS NULL AND expires_at > now();

    IF FOUND THEN
      v_token_consumed := true;
      v_status         := 'active';
      v_role           := v_token_row.role;

      UPDATE signup_tokens SET used_at = now(), used_by = p_user_id WHERE id = v_token_row.id;

      IF v_token_row.target_tenant_id IS NOT NULL THEN
        v_tenant_id := v_token_row.target_tenant_id;
        INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
        VALUES (p_user_id, v_tenant_id, v_role, true, v_status);
        RETURN jsonb_build_object(
          'tenant_id', v_tenant_id, 'account_status', v_status,
          'token_consumed', true, 'joined_existing', true
        );
      END IF;
    END IF;
  END IF;

  v_final_slug := p_slug;
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = v_final_slug) LOOP
    v_counter    := v_counter + 1;
    v_final_slug := p_slug || '-' || v_counter;
  END LOOP;

  INSERT INTO tenants (name, slug, plan, active)
  VALUES (p_company_name, v_final_slug, 'start', true)
  RETURNING id INTO v_tenant_id;

  INSERT INTO user_memberships (user_id, tenant_id, role, active, account_status)
  VALUES (p_user_id, v_tenant_id, v_role, true, v_status);

  INSERT INTO tenant_settings (tenant_id, primary_color, secondary_color, webhook_key)
  VALUES (v_tenant_id, '#00e676', '#00c853', gen_random_uuid())
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id, 'account_status', v_status,
    'token_consumed', v_token_consumed, 'joined_existing', false
  );
END;
$function$;
