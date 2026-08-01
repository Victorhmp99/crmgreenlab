-- ============================================================================
-- Migration 025 — Nova função liberável: SDR WhatsApp
--
-- Adiciona 'sdr_whatsapp' ao catálogo de funções por empresa. Empresas
-- existentes recebem a função ligada (backfill) pra ninguém perder o acesso
-- que já usa hoje — o super admin desliga para quem não deve ter.
-- Novo default passa a incluir 'sdr_whatsapp' também.
-- ============================================================================

ALTER TABLE tenants
  ALTER COLUMN features
  SET DEFAULT ARRAY['automations','financeiro','relatorios','meta_ads','sdr_whatsapp']::text[];

UPDATE tenants
SET features = array_append(features, 'sdr_whatsapp')
WHERE NOT ('sdr_whatsapp' = ANY(features));
