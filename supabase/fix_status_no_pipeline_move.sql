-- ============================================================================
-- FIX: mudança de status do lead NÃO move card pra outra pipeline.
-- Remove qualquer trigger automática que estava fazendo isso.
--
-- Como funciona depois deste SQL:
--   - Você muda status do lead pra 'converted' (ou qualquer outro)
--     → o card CONTINUA na pipeline e stage atual
--   - Card só sai da pipeline quando VOCÊ explicitamente remover (botão X)
--   - Card só vai pra outra pipeline quando VOCÊ adicionar manualmente
-- ============================================================================

-- 1. Remove triggers conhecidas que sincronizam status ↔ pipeline ----------
DROP TRIGGER IF EXISTS sync_lead_status_from_stage      ON pipeline_cards;
DROP TRIGGER IF EXISTS sync_lead_pipeline               ON pipeline_cards;
DROP TRIGGER IF EXISTS auto_move_lead_to_won            ON leads;
DROP TRIGGER IF EXISTS sync_status_to_won_stage         ON leads;
DROP TRIGGER IF EXISTS trg_sync_lead_status             ON pipeline_cards;
DROP TRIGGER IF EXISTS trg_sync_lead_pipeline           ON leads;
DROP TRIGGER IF EXISTS trg_lead_status_to_pipeline      ON leads;
DROP TRIGGER IF EXISTS trg_pipeline_to_lead_status      ON pipeline_cards;
DROP TRIGGER IF EXISTS trg_move_lead_on_convert         ON leads;

-- 2. Remove as funções relacionadas (se existirem) -------------------------
DROP FUNCTION IF EXISTS sync_lead_status_from_stage()       CASCADE;
DROP FUNCTION IF EXISTS sync_lead_pipeline()                CASCADE;
DROP FUNCTION IF EXISTS auto_move_lead_to_won()             CASCADE;
DROP FUNCTION IF EXISTS sync_status_to_won_stage()          CASCADE;
DROP FUNCTION IF EXISTS move_lead_on_convert()              CASCADE;
DROP FUNCTION IF EXISTS lead_status_to_pipeline()           CASCADE;

-- 3. Audita o resultado: lista o que sobrou -------------------------------
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('leads', 'pipeline_cards')
  AND trigger_name NOT LIKE '%updated_at%';
-- Se voltar VAZIO, perfeito — não tem mais trigger interferindo.
-- Se ainda tiver algo, me cola o resultado pra eu adicionar o nome no DROP acima.
