-- ============================================================================
-- Migration 023 — Link do aviso de tarefas aponta pra visão útil
--
-- O "Abrir →" da notificação agora leva pra página de Tarefas (corrigido no
-- frontend — antes caía no dashboard por causa do HashRouter). Quando o aviso
-- inclui tarefas atrasadas, o link vai pra /tasks?atrasadas=1, que abre a
-- TasksPage já focada na lista de TODAS as atrasadas (inclusive de meses
-- passados). Sem atrasadas (só de hoje), vai pra /tasks normal.
-- ============================================================================

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
  v_link  text;
BEGIN
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
        AND (t.due_at AT TIME ZONE 'America/Sao_Paulo')::date <= v_today
        AND COALESCE(t.assigned_to, t.created_by) IS NOT NULL
    ) sub
    GROUP BY tenant_id, recipient_id
  LOOP
    INSERT INTO task_reminder_sent (recipient_id, tenant_id, sent_on)
    VALUES (r.recipient_id, r.tenant_id, v_today)
    ON CONFLICT (recipient_id, tenant_id, sent_on) DO NOTHING;
    CONTINUE WHEN NOT FOUND;

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

    -- Se há atrasadas, abre já filtrado nelas; senão, a agenda normal.
    v_link := CASE WHEN r.overdue_count > 0 THEN '/tasks?atrasadas=1' ELSE '/tasks' END;

    INSERT INTO notifications (tenant_id, recipient_id, created_by, title, body, link)
    VALUES (r.tenant_id, r.recipient_id, NULL, v_title, v_body, v_link);
  END LOOP;

  DELETE FROM task_reminder_sent WHERE sent_on < v_today - 30;
END;
$$;
