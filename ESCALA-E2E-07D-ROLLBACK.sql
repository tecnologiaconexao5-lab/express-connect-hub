-- ESCALA-E2E-07D — ROLLBACK DOS DADOS HML (NÃO EXECUTAR até após E2E-08)
-- ============================================================================
-- Remove SOMENTE os 2 dados temporários de homologação criados na 07D.
-- NÃO afeta nenhum outro registro real.
-- ============================================================================

-- 1) Tabela VUC de homologação
DELETE FROM tabelas_valores
WHERE id = 'b8c78f48-0b8a-4b88-9a41-5d57c5af8886';

-- 2) valor_diaria temporário do PRESTADOR TESTE APP
UPDATE prestadores
SET valor_diaria = NULL
WHERE id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
  AND valor_diaria = 250.00;

-- Conferência pós-rollback:
--   SELECT count(*) FROM tabelas_valores WHERE tipo_veiculo='vuc';        -- esperado 0
--   SELECT valor_diaria FROM prestadores WHERE id='e6646799-...';         -- esperado NULL
