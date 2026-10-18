-- FIN-MASTER-363D.2B2.3 — Classificação Tri-State pagamentos_prestadores
-- Adiciona classificacao_dado TEXT CHECK(real,teste,duvidoso)
-- Fonte canônica de classificação — substitui lógica derivada de is_teste.

ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS classificacao_dado text
  CONSTRAINT chk_classificacao_dado CHECK (classificacao_dado IN ('real','teste','duvidoso'));

COMMENT ON COLUMN pagamentos_prestadores.classificacao_dado
  IS 'FIN-363D.2B2.3: classificação canônica real/teste/duvidoso — fonte única de verdade';
