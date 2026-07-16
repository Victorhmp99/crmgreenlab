-- ============================================================================
-- Migration 018 — Realtime em notifications
--
-- Habilita Supabase Realtime na tabela notifications, para que o frontend
-- receba INSERTs em tempo real (pop-up de notificação), além do sininho
-- (que já funciona por polling). RLS já restringe cada usuário a receber
-- apenas eventos das próprias notificações (recipient_id = auth.uid()).
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
