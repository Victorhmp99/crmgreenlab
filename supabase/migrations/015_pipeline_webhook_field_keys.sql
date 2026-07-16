-- ============================================================================
-- Migration 015 — webhook_field_keys em pipelines
--
-- Objetivo:
--   Cada pipeline (por tenant) pode escolher quais campos personalizados
--   (lead_field_definitions.field_key) fazem parte da automação/formulário
--   externo dela. NULL = comportamento retrocompatível (considera todos os
--   campos ativos do tenant, como era antes desta migration).
-- ============================================================================

ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS webhook_field_keys text[] DEFAULT NULL;
