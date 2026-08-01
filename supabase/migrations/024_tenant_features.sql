-- ============================================================================
-- Migration 024 — Funções liberadas por empresa (feature flags / "Pro")
--
-- Permite ao super admin ligar/desligar funções por empresa (automações,
-- financeiro, relatórios, meta ads e futuras), independente do cargo do
-- usuário. Serve pra cobrar por recurso no futuro.
--
-- Segurança: RLS em tenants só permite SELECT ao membro (ele LÊ as features
-- pra UI). Escrita é SÓ via set_tenant_features (SECURITY DEFINER + checagem
-- de super admin) — nenhum usuário comum consegue se auto-liberar função.
-- ============================================================================

-- Lista de funções liberadas. Empresas existentes recebem todas as 4 atuais
-- (preserva o comportamento de hoje — ninguém perde acesso).
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL
  DEFAULT ARRAY['automations','financeiro','relatorios','meta_ads']::text[];

-- Helper para reforço no backend (ex.: gates em RPCs no futuro).
CREATE OR REPLACE FUNCTION tenant_has_feature(p_tenant_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p_feature = ANY(features) FROM tenants WHERE id = p_tenant_id),
    false
  );
$$;

-- Escrita das features — SOMENTE super admin. Guarda os valores distintos
-- passados pelo painel (extensível: funções novas não exigem mexer aqui).
CREATE OR REPLACE FUNCTION set_tenant_features(p_tenant_id uuid, p_features text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: super admin only';
  END IF;

  UPDATE tenants
  SET features = COALESCE(
    ARRAY(
      SELECT DISTINCT trim(f)
      FROM unnest(COALESCE(p_features, ARRAY[]::text[])) AS f
      WHERE trim(f) <> ''
    ),
    ARRAY[]::text[]
  )
  WHERE id = p_tenant_id;
END;
$$;

-- get_platform_stats passa a devolver as features de cada empresa (pro painel).
DROP FUNCTION IF EXISTS get_platform_stats();
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE(
  tenant_id uuid, tenant_name text, tenant_slug text, tenant_plan text,
  tenant_active boolean, tenant_created_at timestamptz,
  user_count bigint, lead_count bigint, tenant_features text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: super admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id, t.name, t.slug, t.plan, t.active, t.created_at,
    COUNT(DISTINCT um.user_id)::bigint AS user_count,
    COUNT(DISTINCT l.id)::bigint       AS lead_count,
    t.features
  FROM tenants t
  LEFT JOIN user_memberships um ON um.tenant_id = t.id AND um.active = true
  LEFT JOIN leads l             ON l.tenant_id  = t.id
  GROUP BY t.id, t.name, t.slug, t.plan, t.active, t.created_at, t.features
  ORDER BY t.created_at DESC;
END;
$$;