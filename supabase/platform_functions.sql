-- ================================================================
-- GREEN HUB — Funções do Painel de Plataforma (Super Admin)
-- Execute este arquivo no SQL Editor do Supabase
-- ================================================================

-- Tabela de super admins (donos da plataforma)
CREATE TABLE IF NOT EXISTS super_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admin só vê a si mesmo
CREATE POLICY "super_admins_see_self" ON super_admins
  FOR SELECT USING (user_id = auth.uid());


-- ----------------------------------------------------------------
-- Função: retorna stats de todos os tenants (super admin only)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  tenant_id         uuid,
  tenant_name       text,
  tenant_slug       text,
  tenant_plan       text,
  tenant_active     boolean,
  tenant_created_at timestamptz,
  user_count        bigint,
  lead_count        bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: super admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.active,
    t.created_at,
    COUNT(DISTINCT um.user_id)::bigint AS user_count,
    COUNT(DISTINCT l.id)::bigint       AS lead_count
  FROM tenants t
  LEFT JOIN user_memberships um ON um.tenant_id = t.id AND um.active = true
  LEFT JOIN leads l             ON l.tenant_id  = t.id
  GROUP BY t.id, t.name, t.slug, t.plan, t.active, t.created_at
  ORDER BY t.created_at DESC;
END;
$$;


-- ----------------------------------------------------------------
-- Função: ativa/desativa um tenant (super admin only)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_tenant_active(
  p_tenant_id uuid,
  p_active    boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: super admin only';
  END IF;

  UPDATE tenants SET active = p_active WHERE id = p_tenant_id;
END;
$$;


-- ----------------------------------------------------------------
-- IMPORTANTE: adicionar o primeiro super admin manualmente
-- Substitua 'SEU_USER_ID' pelo ID do seu usuário no Supabase
-- (Authentication → Users → copie o UUID)
-- ----------------------------------------------------------------
-- INSERT INTO super_admins (user_id) VALUES ('SEU_USER_ID_AQUI');
