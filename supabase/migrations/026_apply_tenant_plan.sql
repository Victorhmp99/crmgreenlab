-- ============================================================================
-- Migration 026 — Aplicar plano numa empresa (atalho que liga o pacote)
--
-- Planos são presets de funções (Start/Standard/Plus). Aplicar um plano grava
-- o NOME do plano (tenants.plan) e o PACOTE de funções (tenants.features) de
-- uma vez. Depois o super admin ainda pode ligar/desligar função específica
-- por cliente via set_tenant_features (as funções continuam sendo a verdade;
-- o plano é só o baseline).
--
-- Segurança: SÓ super admin (SECURITY DEFINER + checagem). RLS de tenants não
-- permite UPDATE direto por usuário comum.
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_tenant_plan(p_tenant_id uuid, p_plan text, p_features text[])
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
  SET plan = COALESCE(NULLIF(trim(p_plan), ''), plan),
      features = COALESCE(
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
