-- ============================================================
-- Migration 012: Políticas RLS para cadastro de novo tenant
-- Executar no Supabase Dashboard → SQL Editor
-- ============================================================

-- Permite que um usuário autenticado crie seu próprio tenant
-- (necessário no fluxo de registro de nova clínica)
CREATE POLICY "authenticated_users_can_create_tenant"
  ON tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permite que o admin recém-criado insira sua própria membership
-- A restrição é que o user_id do insert bate com o uid() autenticado
CREATE POLICY "users_can_create_own_membership"
  ON user_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Permite que o admin crie as configurações iniciais do tenant
-- (só se o tenant_id pertencer a um tenant onde ele é membro)
CREATE POLICY "admin_can_create_tenant_settings"
  ON tenant_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_memberships
      WHERE user_id    = auth.uid()
        AND tenant_id  = tenant_settings.tenant_id
        AND role       = 'admin'
        AND active     = true
    )
  );

-- Verifica se as políticas existentes cobrem SELECT em tenants
-- (caso não exista, cria uma para o membro ler seu próprio tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tenants'
      AND policyname = 'members_can_read_own_tenant'
  ) THEN
    CREATE POLICY "members_can_read_own_tenant"
      ON tenants
      FOR SELECT
      TO authenticated
      USING (
        id IN (
          SELECT tenant_id FROM user_memberships
          WHERE user_id = auth.uid() AND active = true
        )
      );
  END IF;
END $$;
