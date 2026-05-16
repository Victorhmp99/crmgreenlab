-- ================================================================
-- Adiciona webhook_key à tabela tenant_settings
-- Execute no SQL Editor do Supabase (projeto miezatcdfldmqmxgpkwr)
-- ================================================================

-- 1. Adiciona a coluna webhook_key com valor padrão auto-gerado
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS webhook_key uuid NOT NULL DEFAULT gen_random_uuid();

-- 2. Gera chaves para tenants que já existem (caso a coluna já existed sem default)
UPDATE tenant_settings
SET webhook_key = gen_random_uuid()
WHERE webhook_key IS NULL;

-- 3. Função para regenerar a webhook_key de um tenant (chamada pelo frontend)
CREATE OR REPLACE FUNCTION regenerate_webhook_key(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key uuid;
BEGIN
  -- Só o próprio tenant pode regenerar a chave
  IF NOT EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_id   = auth.uid()
      AND tenant_id = p_tenant_id
      AND active    = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_new_key := gen_random_uuid();

  UPDATE tenant_settings
  SET webhook_key = v_new_key
  WHERE tenant_id = p_tenant_id;

  RETURN v_new_key;
END;
$$;

GRANT EXECUTE ON FUNCTION regenerate_webhook_key(uuid) TO authenticated;
