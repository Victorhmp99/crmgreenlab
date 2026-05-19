-- ============================================================================
-- DIAGNÓSTICO: triggers em leads e pipeline_cards
-- Rode no SQL Editor do Supabase pra descobrir o que está movendo o card.
-- ============================================================================

-- Lista TODOS os triggers em leads e pipeline_cards (exceto os de updated_at)
SELECT
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('leads', 'pipeline_cards')
ORDER BY event_object_table, trigger_name;
