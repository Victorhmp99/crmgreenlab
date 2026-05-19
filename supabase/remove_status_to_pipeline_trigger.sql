-- ============================================================================
-- REMOVE a trigger que move cards entre pipelines quando o status do lead muda.
--
-- ANTES (problema):
--   Você muda status do lead pra 'converted' →
--   trigger_sync_pipeline_from_status dispara →
--   sync_pipeline_from_lead_status() move o card pra outra pipeline.
--
-- DEPOIS:
--   Mudança de status NÃO mexe na pipeline. Card fica onde está.
--   Você só move card manualmente pelo Kanban (arrastar ou X + adicionar).
--
-- MANTIDA: a trigger inversa (pipeline_cards → leads.status)
--   Continua funcionando, ou seja, arrastar pra stage 'won' marca como convertido,
--   arrastar pra stage 'lost' marca como perdido. Isso é útil e não causa o bug.
--   Se quiser remover essa também, descomente as linhas no final.
-- ============================================================================

-- Remove APENAS a trigger e função que vão de leads.status → pipeline_cards
DROP TRIGGER  IF EXISTS trigger_sync_pipeline_from_status ON leads;
DROP FUNCTION IF EXISTS sync_pipeline_from_lead_status() CASCADE;

-- ── OPCIONAL — só descomente se quiser que arrastar o card também NÃO
-- mude o status do lead automaticamente:
-- DROP TRIGGER  IF EXISTS trigger_sync_lead_status ON pipeline_cards;
-- DROP FUNCTION IF EXISTS sync_lead_status_from_pipeline() CASCADE;

-- Audita o resultado
SELECT
  trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('leads', 'pipeline_cards')
  AND trigger_name NOT LIKE '%updated_at%';
