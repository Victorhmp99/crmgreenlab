-- ============================================================================
-- Migration 016 — webhook_rate_limits
--
-- Objetivo:
--   Log de tentativas ao endpoint público receive-lead (POST /functions/v1/
--   receive-lead), usado pela edge function pra aplicar rate limiting por
--   tenant_id + IP e evitar flood/spam de leads falsos.
--
--   Só a edge function (service_role, que faz bypass de RLS) grava/lê aqui.
--   RLS fica ativo sem policies — bloqueia qualquer acesso via client
--   autenticado ou anônimo.
-- ============================================================================

-- SEM FK para tenants(id) de propósito: o rate limit precisa registrar
-- tentativas mesmo quando o tenant_id é forjado/inexistente — é o cenário
-- mais provável de abuso (bot testando IDs aleatórios). Uma FK bloquearia
-- esse insert e deixaria esse tipo de ataque sem limite nenhum.
CREATE TABLE IF NOT EXISTS webhook_rate_limits (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_tenant_created
  ON webhook_rate_limits (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_tenant_ip_created
  ON webhook_rate_limits (tenant_id, ip, created_at DESC);

ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies de propósito: só service_role (edge function) acessa esta tabela.
