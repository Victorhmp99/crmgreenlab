-- ============================================================================
-- FIXES — 3 problemas:
-- 1. Excluir lead falha pra Super Admin Master (RLS não tem bypass)
-- 2. Remover card da pipeline falha pra Super Admin Master (RLS não tem bypass)
-- 3. Master vê notificações de TODOS (causa botões "Limpar" parecerem não funcionar)
-- ============================================================================

-- ── 1. LEADS: permitir DELETE pra super admin ──────────────────────────────
DROP POLICY IF EXISTS "managers_delete_leads"   ON leads;
DROP POLICY IF EXISTS "super_or_managers_delete_leads" ON leads;

CREATE POLICY "super_or_managers_delete_leads" ON leads
  FOR DELETE USING (
    -- Super admin (master ou auxiliary) pode deletar qualquer lead
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    -- OU admin/manager do tenant
    OR tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND active = true
    )
  );

-- ── 2. PIPELINE_CARDS: permitir manage pra super admin ────────────────────
DROP POLICY IF EXISTS "tenant_members_manage_cards"   ON pipeline_cards;
DROP POLICY IF EXISTS "super_or_members_manage_cards" ON pipeline_cards;

CREATE POLICY "super_or_members_manage_cards" ON pipeline_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    OR tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid())
    OR tenant_id IN (
      SELECT tenant_id FROM user_memberships
       WHERE user_id = auth.uid() AND active = true
    )
  );

-- ── 3. NOTIFICATIONS: SELECT só dos próprios (sem bypass de master) ─────────
-- Master ainda pode ENVIAR (INSERT via RPC SECURITY DEFINER) mas não VÊ os
-- recebidos por outros. Master também só vê suas próprias no sino.
DROP POLICY IF EXISTS "notif_recipient_select" ON notifications;

CREATE POLICY "notif_recipient_select" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- DELETE também só do próprio (sem bypass de master no select)
DROP POLICY IF EXISTS "notif_recipient_delete" ON notifications;
CREATE POLICY "notif_recipient_delete" ON notifications
  FOR DELETE USING (recipient_id = auth.uid());

-- ── 4. Limpa notificações que o master recebeu antes do fix de duplicação ───
DELETE FROM notifications
 WHERE recipient_id IN (
   SELECT user_id FROM super_admins WHERE type = 'master'
 );

-- ── Verificação ─────────────────────────────────────────────────────────────
-- Lista o que sobrou (deve ser 0 ou só notificações de antes pra outros)
SELECT 'Notificações restantes (todos)' AS info, COUNT(*)::text AS valor FROM notifications;
