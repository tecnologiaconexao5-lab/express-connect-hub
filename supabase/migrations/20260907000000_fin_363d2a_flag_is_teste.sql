-- FIN-MASTER-363D.2A — Flag is_teste para segregação TESTE x REAL
-- Adiciona coluna is_teste BOOLEAN DEFAULT false NOT NULL
-- em 3 tabelas de negócio para que indicadores ignorem dados de teste.
-- Default false = todos os registros existentes permanecem como REAL.
-- Classificação: executada via script CJS (não nesta migration).

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;
ALTER TABLE financeiro_receber ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;
ALTER TABLE financeiro_pagar ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN ordens_servico.is_teste IS 'FIN-363D.2A: true = registro de teste/homologação, ignorado por indicadores por padrão';
COMMENT ON COLUMN financeiro_receber.is_teste IS 'FIN-363D.2A: true = registro de teste/homologação, ignorado por indicadores por padrão';
COMMENT ON COLUMN financeiro_pagar.is_teste IS 'FIN-363D.2A: true = registro de teste/homologação, ignorado por indicadores por padrão';
