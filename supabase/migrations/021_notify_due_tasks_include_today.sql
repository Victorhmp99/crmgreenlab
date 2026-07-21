-- ============================================================================
-- Migration 021 — Notificação de tarefas também inclui "tarefas de hoje"
--
-- Antes só notificava tarefas já vencidas (due_at <= now()). Agora também
-- notifica tarefas marcadas pra HOJE mesmo que o horário exato ainda não
-- tenha chegado — pedido explícito: "só vencidas ou tarefas que tenho pro dia".
-- Título da notificação distingue os dois casos.
-- ============================================================================

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
    SELECT t.id, t.tenant_id, t.title, t.lead_id, t.due_at,
           COALESCE(t.assigned_to, t.created_by) AS recipient_id
    FROM lead_tasks t
    WHERE t.completed = false
      AND t.due_at::date <= current_date   -- vencida (dia passado) OU marcada pra hoje
      AND (t.notified_at IS NULL OR t.notified_at < t.updated_at)
      AND COALESCE(t.assigned_to, t.created_by) IS NOT NULL
  LOOP
    INSERT INTO notifications (tenant_id, recipient_id, created_by, title, body, link)
    VALUES (
      r.tenant_id, r.recipient_id, NULL,
      CASE WHEN r.due_at <= now() THEN 'Tarefa vencendo' ELSE 'Tarefa de hoje' END,
      r.title, '/tasks'
    );

    UPDATE lead_tasks SET notified_at = now() WHERE id = r.id;
  END LOOP;
END;
$$;
