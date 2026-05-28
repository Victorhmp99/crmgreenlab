-- ============================================================================
-- Migration 013 — Chave composta (phone, tenant_id) na tabela leads
--
-- Regra de negócio:
--   • O mesmo telefone PODE existir em empresas diferentes (sem conflito).
--   • Dentro da mesma empresa o telefone é único (evita duplicatas intra-tenant).
--   • NULLs nunca conflitam entre si (comportamento nativo do PostgreSQL).
--
-- Estratégia de preservação de dados:
--   1. Remove qualquer constraint global de phone que possa existir.
--   2. Limpa duplicatas intra-tenant que impediriam a criação da nova constraint
--      (mantém o registro com updated_at mais recente; em empate mantém o id maior).
--   3. Adiciona constraint UNIQUE (phone, tenant_id).
-- ============================================================================

-- ── 1. Remove constraint/índice global de phone (caso exista) ────────────────
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_phone_key;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_phone_unique;
DROP INDEX  IF EXISTS leads_phone_key;
DROP INDEX  IF EXISTS leads_phone_unique;

-- ── 2. Remove duplicatas intra-tenant ────────────────────────────────────────
-- Para cada par (phone, tenant_id) duplicado mantém apenas o registro mais
-- recente (updated_at DESC). Em empate de timestamp usa o id maior como critério.
DELETE FROM leads
WHERE phone IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (phone, tenant_id) id
    FROM   leads
    WHERE  phone IS NOT NULL
    ORDER  BY phone, tenant_id, updated_at DESC, id DESC
  );

-- ── 3. Adiciona constraint composta ──────────────────────────────────────────
-- NULL não viola UNIQUE (dois NULLs não são iguais no PostgreSQL),
-- por isso não precisamos de um índice parcial.
ALTER TABLE leads
  ADD CONSTRAINT leads_phone_tenant_unique UNIQUE (phone, tenant_id);

-- ── 4. Índice de apoio (já existia em whatsapp_integration.sql) ───────────────
-- Garante que a busca normalizada usada pelo webhook seja coberta
-- mesmo que o script anterior não tenha sido aplicado neste ambiente.
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized
  ON leads (tenant_id, normalize_phone(phone))
  WHERE phone IS NOT NULL;
