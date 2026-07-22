-- ============================================================================
-- Migration 022 — Notificação de tarefas: UM aviso-resumo por pessoa
--
-- Antes: a função inseria UMA notificação por tarefa (várias por dia), e usava
-- current_date (UTC) — no Brasil "hoje" virava errado depois das 21h.
--
-- Agora (pedido explícito):
--   • Um único aviso-resumo por pessoa: "X atrasada(s) e Y para hoje" — nunca
--     uma notificação por tarefa.
--   • No máximo 1 aviso por dia por pessoa/empresa (tabela task_reminder_sent),
--     pra não repetir a cada rodada do cron (5 min).
--   • Fuso de Brasília (America/Sao_Paulo) — "hoje" correto.
--   • Destinatário: SÓ o dono da tarefa — o responsável (assigned_to); se não
--     houver responsável, o criador (created_by). Nunca a empresa inteira.
-- ============================================================================

-- Controle de "já avisei essa pessoa hoje" (por empresa). Tabela interna:
-- escrita só pela função SECURITY DEFINER (owner bypassa RLS). Sem policies →
-- nenhum cliente acessa direto.
CREATE TABLE IF NOT EXISTS task_reminder_sent (
  recipient_id uuid NOT NULL,
  tenant_id    uuid NOT NULL,
  sent_on      date NOT NULL,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (recipient_id, tenant_id, sent_on)
);
ALTER TABLE task_reminder_sent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION notify_due_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_title text;
  v_body  text;
BEGIN
  -- Agrupa por (empresa, pessoa): conta atrasadas e de-hoje de cada dono.
  FOR r IN
    SELECT tenant_id, recipient_id,
           COUNT(*) FILTER (WHERE is_overdue)      AS overdue_count,
           COUNT(*) FILTER (WHERE NOT is_overdue)  AS today_count
    FROM (
      SELECT t.tenant_id,
             COALESCE(t.assigned_to, t.created_by) AS recipient_id,
             (t.due_at AT TIME ZONE 'America/Sao_Paulo')::date < v_today AS is_overdue
      FROM lead_tasks t
      WHERE t.completed = false
        AND (t.due_at AT TIME ZONE 'America/Sao_Paulo')::date <= v_today  -- vencida OU pra hoje
        AND COALESCE(t.assigned_to, t.created_by) IS NOT NULL
    ) sub
    GROUP BY tenant_id, recipient_id
  LOOP
    -- No máximo 1 aviso por pessoa/empresa/dia. O row só é criado quando de
    -- fato há tarefas a avisar, então a 1ª vez no dia em que a pessoa tem
    -- pendências ela recebe; depois fica silencioso até o dia seguinte.
    INSERT INTO task_reminder_sent (recipient_id, tenant_id, sent_on)
    VALUES (r.recipient_id, r.tenant_id, v_today)
    ON CONFLICT (recipient_id, tenant_id, sent_on) DO NOTHING;
    CONTINUE WHEN NOT FOUND;   -- já avisado hoje

    IF r.overdue_count > 0 AND r.today_count > 0 THEN
      v_title := 'Tarefas pendentes';
      v_body  := r.overdue_count || ' atrasada' || CASE WHEN r.overdue_count > 1 THEN 's' ELSE '' END
              || ' e ' || r.today_count || ' para hoje';
    ELSIF r.overdue_count > 0 THEN
      v_title := 'Tarefas atrasadas';
      v_body  := 'Você tem ' || r.overdue_count
              || CASE WHEN r.overdue_count > 1 THEN ' tarefas atrasadas' ELSE ' tarefa atrasada' END;
    ELSE
      v_title := 'Tarefas de hoje';
      v_body  := 'Você tem ' || r.today_count
              || CASE WHEN r.today_count > 1 THEN ' tarefas' ELSE ' tarefa' END || ' para hoje';
    END IF;

    INSERT INTO notifications (tenant_id, recipient_id, created_by, title, body, link)
    VALUES (r.tenant_id, r.recipient_id, NULL, v_title, v_body, '/tasks');
  END LOOP;

  -- Housekeeping: controle de dias antigos não precisa ficar guardado.
  DELETE FROM task_reminder_sent WHERE sent_on < v_today - 30;
END;
$$;
