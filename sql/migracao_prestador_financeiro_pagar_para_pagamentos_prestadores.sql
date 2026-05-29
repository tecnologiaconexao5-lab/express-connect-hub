-- ============================================================
-- MIGRAÇÃO ASSISTIDA: Prestadores em financeiro_pagar → pagamentos_prestadores
-- 
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE.
-- Revise os registros ANTES de migrar.
-- ============================================================

-- 1. DIAGNÓSTICO: Listar registros de prestador em financeiro_pagar
SELECT 
  fp.id AS financeiro_pagar_id,
  fp.prestador_id,
  fp.prestador AS prestador_nome,
  fp.os_id,
  fp.valor,
  fp.descricao,
  fp.data_vencimento,
  fp.status,
  fp.created_at
FROM financeiro_pagar fp
WHERE fp.prestador_id IS NOT NULL
   OR fp.prestador IS NOT NULL
ORDER BY fp.created_at DESC;

-- 2. VERIFICAR se já existe em pagamentos_prestadores (evitar duplicidade)
SELECT 
  fp.id AS financeiro_pagar_id,
  fp.prestador_id,
  fp.os_id,
  fp.valor,
  pp.id AS pagamento_prestador_existente
FROM financeiro_pagar fp
LEFT JOIN pagamentos_prestadores pp ON pp.os_id = fp.os_id AND pp.origem_lancamento = 'os_finalizada'
WHERE (fp.prestador_id IS NOT NULL OR fp.prestador IS NOT NULL)
  AND fp.os_id IS NOT NULL
ORDER BY fp.created_at DESC;

-- 3. MIGRAÇÃO (apenas se confirmar que não duplica):
-- Descomente e execute APÓS revisão manual.
-- 
-- INSERT INTO pagamentos_prestadores (
--     prestador_id,
--     prestador_nome,
--     os_id,
--     os_numero,
--     valor,
--     valor_liquido,
--     valor_servicos,
--     tipo_lancamento,
--     natureza,
--     data_competencia,
--     data_prevista_pagamento,
--     status_conferencia,
--     status_pagamento,
--     origem_lancamento,
--     quantidade_os,
--     periodo_inicio,
--     periodo_fim,
--     categoria_financeira
-- )
-- SELECT 
--     fp.prestador_id,
--     fp.prestador,
--     fp.os_id,
--     NULL AS os_numero,
--     fp.valor,
--     fp.valor,
--     fp.valor,
--     'Serviço OS' AS tipo_lancamento,
--     'credito' AS natureza,
--     fp.data_vencimento AS data_competencia,
--     fp.data_vencimento AS data_prevista_pagamento,
--     'em_aberto' AS status_conferencia,
--     CASE 
--         WHEN fp.status = 'paga' THEN 'pago'
--         WHEN fp.status = 'cancelada' THEN 'cancelado'
--         ELSE 'pendente'
--     END AS status_pagamento,
--     'os_finalizada' AS origem_lancamento,
--     1 AS quantidade_os,
--     fp.data_vencimento AS periodo_inicio,
--     fp.data_vencimento AS periodo_fim,
--     'Custo Logístico' AS categoria_financeira
-- FROM financeiro_pagar fp
-- WHERE (fp.prestador_id IS NOT NULL OR fp.prestador IS NOT NULL)
--   AND fp.os_id IS NOT NULL
--   AND NOT EXISTS (
--       SELECT 1 FROM pagamentos_prestadores pp 
--       WHERE pp.os_id = fp.os_id 
--         AND pp.origem_lancamento = 'os_finalizada'
--   );

-- 4. APÓS MIGRAÇÃO: Verificar resultado
-- SELECT COUNT(*) AS migrados FROM pagamentos_prestadores WHERE origem_lancamento = 'os_finalizada';
