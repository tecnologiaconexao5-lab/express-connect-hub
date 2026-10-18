-- FASE P3 — Anti-duplicidade e idempotência para conectores
-- Adiciona idempotency_key a ia_execucoes_conectores

ALTER TABLE ia_execucoes_conectores
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_idempotency
ON ia_execucoes_conectores (idempotency_key, status);
