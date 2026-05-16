-- ============================================================================
-- APENAS a função debug_funnel — mínimo, sem dependências.
-- Roda esse arquivo no SQL Editor do Supabase, depois:
--   SELECT * FROM debug_funnel('SEU_TENANT_ID_AQUI');
-- ============================================================================

CREATE OR REPLACE FUNCTION debug_funnel(p_tenant_id uuid)
RETURNS TABLE (
  info  text,
  value text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Total de leads
  RETURN QUERY
  SELECT 'Total leads'::text, COUNT(*)::text FROM leads WHERE tenant_id = p_tenant_id;

  -- 2. Leads por status
  RETURN QUERY
  SELECT ('Leads status=' || status::text)::text, COUNT(*)::text
    FROM leads WHERE tenant_id = p_tenant_id
   GROUP BY status;

  -- 3. Total de disparos
  RETURN QUERY
  SELECT 'Total disparos'::text, COUNT(*)::text
    FROM lead_activities WHERE tenant_id = p_tenant_id;

  -- 4. Disparos por tipo
  RETURN QUERY
  SELECT ('Disparos type=' || type::text)::text, COUNT(*)::text
    FROM lead_activities WHERE tenant_id = p_tenant_id
   GROUP BY type;

  -- 5. Leads DISTINCT por tipo de disparo
  RETURN QUERY
  SELECT ('Leads DISTINCT com disparo type=' || la.type::text)::text,
         COUNT(DISTINCT la.lead_id)::text
    FROM lead_activities la
    JOIN leads l ON l.id = la.lead_id
   WHERE l.tenant_id = p_tenant_id
   GROUP BY la.type;

  -- 6. Passos do funil e seus activity_types
  RETURN QUERY
  SELECT ('Passo ' || fs.position::text || ' "' || fs.name || '"')::text,
         ('activity_types = ' || COALESCE(fs.activity_types::text, 'NULL'))::text
    FROM funnel_steps fs
   WHERE fs.tenant_id = p_tenant_id
   ORDER BY fs.position;
END;
$$;

GRANT EXECUTE ON FUNCTION debug_funnel(uuid) TO authenticated;
