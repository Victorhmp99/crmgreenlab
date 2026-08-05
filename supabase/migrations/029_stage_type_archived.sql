-- ============================================================================
-- Migration 029 — Etapa tipo "Arquivado" (arquiva o lead automaticamente)
--
-- Adiciona 'archived' aos tipos de etapa possíveis. Quando um card é movido
-- pra uma etapa desse tipo, o frontend seta leads.status='archived'
-- automaticamente (mesmo padrão já usado pra 'won'→converted e 'lost'→lost).
-- leads.status já aceita 'archived' livremente (é texto, sem CHECK) e já é
-- usado em outros pontos do sistema (dashboard, relatórios, exportação).
-- ============================================================================

ALTER TABLE pipeline_stages DROP CONSTRAINT pipeline_stages_stage_type_check;
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_stage_type_check
  CHECK (stage_type = ANY (ARRAY['in_progress'::text, 'won'::text, 'lost'::text, 'archived'::text]));
