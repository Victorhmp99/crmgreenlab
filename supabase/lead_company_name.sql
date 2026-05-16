-- ============================================================================
-- Adiciona campo company_name em leads (nome da empresa do lead)
-- ============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_name text;

CREATE INDEX IF NOT EXISTS idx_leads_company_name
  ON leads (tenant_id, company_name) WHERE company_name IS NOT NULL;
