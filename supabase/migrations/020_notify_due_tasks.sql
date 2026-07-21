-- ============================================================================
-- Migration 020 — Notifica tarefas vencendo
--
-- Reaproveita a tabela notifications que já existe (sininho + pop-up central
-- já funcionam, sem mudar nada no frontend). Um job automático (pg_cron)
-- roda a cada 5 min, encontra tarefas com due_at já chegado, não concluídas,
-- ainda não notificadas (ou reagendadas depois da última notificação), e
-- cria uma notificação pro responsável.
-- ============================================================================

-- Marca quando a tarefa já gerou notificação — evita duplicar a cada rodada do cron
ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION notify_due_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.tenant_id, t.title, t.lead_id,
           COALESCE(t.assigned_to, t.created_by) AS recipient_id
    FROM lead_tasks t
    WHERE t.completed = false
      AND t.due_at <= now()
      -- nunca notificada, OU a tarefa foi editada (ex: remarcada) depois da última notificação
      AND (t.notified_at IS NULL OR t.notified_at < t.updated_at)
      AND COALESCE(t.assigned_to, t.created_by) IS NOT NULL
  LOOP
    INSERT INTO notifications (tenant_id, recipient_id, created_by, title, body, link)
    VALUES (r.tenant_id, r.recipient_id, NULL, 'Tarefa vencendo', r.title, '/tasks');

    UPDATE lead_tasks SET notified_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;

-- Habilita o agendador e registra o job (a cada 5 minutos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'notify-due-tasks',
  '*/5 * * * *',
  $$SELECT notify_due_tasks()$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-due-tasks');
