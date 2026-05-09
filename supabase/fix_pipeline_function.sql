-- ================================================================
-- Recria a função create_pipeline_with_defaults como SECURITY DEFINER
-- para garantir que o INSERT nas tabelas funcione independente do RLS.
-- Execute no SQL Editor do Supabase.
-- ================================================================

CREATE OR REPLACE FUNCTION create_pipeline_with_defaults(
  p_tenant_id uuid,
  p_name      text,
  p_color     text DEFAULT '#00e676'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_position    integer;
BEGIN
  -- Verifica se o usuário é membro do tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_id   = auth.uid()
      AND tenant_id = p_tenant_id
      AND active    = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of this tenant';
  END IF;

  SELECT COALESCE(MAX(position) + 1, 0)
  INTO   v_position
  FROM   pipelines
  WHERE  tenant_id = p_tenant_id;

  INSERT INTO pipelines (tenant_id, name, color, position)
  VALUES (p_tenant_id, p_name, p_color, v_position)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, color, position, is_final) VALUES
    (p_tenant_id, v_pipeline_id, 'Novo Lead',     '#6366F1', 0, false),
    (p_tenant_id, v_pipeline_id, 'Contato Feito', '#3B82F6', 1, false),
    (p_tenant_id, v_pipeline_id, 'Agendado',      '#F59E0B', 2, false),
    (p_tenant_id, v_pipeline_id, 'Em Negociação', '#EC4899', 3, false),
    (p_tenant_id, v_pipeline_id, 'Fechado',       '#10B981', 4, true),
    (p_tenant_id, v_pipeline_id, 'Perdido',       '#EF4444', 5, true);

  RETURN v_pipeline_id;
END;
$$;
