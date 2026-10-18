-- FIN-MASTER-363D.2B2 — Flag is_teste em pagamentos_prestadores
-- Adiciona coluna is_teste BOOLEAN DEFAULT false NOT NULL.
-- Classificação executada via script CJS (42 registros com evidência inequívoca).

ALTER TABLE pagamentos_prestadores ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pagamentos_prestadores.is_teste IS 'FIN-363D.2B2: true = registro de teste/homologação, ignorado por indicadores por padrão';
