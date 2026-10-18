-- FIN-SANE-02H.2 — Atomicidade RPC f_confirmar_pagamento_fechamento
-- Lab test: falha, sucesso, idempotência, concorrência, regressão
-- ZERO WRITES em produção

-- ═══════════════════════════════════════════════════════════════
-- SETUP: baseline + forward (já aplicados pelo lab runner)
-- ═══════════════════════════════════════════════════════════════

-- Helper: conta linhas
CREATE OR REPLACE FUNCTION _cnt(p_tab TEXT, p_where TEXT) RETURNS INTEGER AS $$
DECLARE v_n INTEGER;
BEGIN
  EXECUTE 'SELECT COUNT(*) FROM ' || p_tab || ' WHERE ' || p_where INTO v_n;
  RETURN v_n;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- TESTE 1: FALHA 3º ITEM → ROLLBACK TOTAL
-- ═══════════════════════════════════════════════════════════════

-- 1.1 Snapshop ANTES
-- (contagens zeradas pois é banco novo)

-- 1.2 Criar dados base
INSERT INTO clientes (id, nome_fantasia, razao_social, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Cliente Teste 02H2', 'Cliente Teste 02H2 LTDA', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', '11122233344', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- 1.3 Criar fechamento
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  NULL, 1500.00, 'em_aberto', 'pendente', 'aprovado',
  'fechamento', ' teste', 0,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true
);

-- 1.4 Criar 3 itens vinculados ao fechamento
-- Item 1: válido, tem titulo correspondente
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa,
  fechamento_id
) VALUES (
  'f0000000-0000-0000-0000-000000000011',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  '11111111-1111-1111-1111-111111111111', 500.00, 'em_aberto', 'pendente', 'aprovado',
  'os_direta', 'escala_direta', 1,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true,
  'f0000000-0000-0000-0000-000000000001'
);
-- Titulo correspondente para item 1
INSERT INTO financeiro_pagar (
  id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome,
  data_vencimento, descricao
) VALUES (
  '10000000-0000-0000-0000-000000000011',
  '11111111-1111-1111-1111-111111111111', 500.00, 'pendente',
  'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Item 1'
);

-- Item 2: válido, tem titulo correspondente
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa,
  fechamento_id
) VALUES (
  'f0000000-0000-0000-0000-000000000012',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  '22222222-2222-2222-2222-222222222222', 500.00, 'em_aberto', 'pendente', 'aprovado',
  'os_direta', 'escala_direta', 1,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true,
  'f0000000-0000-0000-0000-000000000001'
);
-- Titulo correspondente para item 2
INSERT INTO financeiro_pagar (
  id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome,
  data_vencimento, descricao
) VALUES (
  '10000000-0000-0000-0000-000000000012',
  '22222222-2222-2222-2222-222222222222', 500.00, 'pendente',
  'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Item 2'
);

-- Item 3: SEM titulo correspondente → f_confirmar_pagamento_prestador vai falhar
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa,
  fechamento_id
) VALUES (
  'f0000000-0000-0000-0000-000000000013',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  '33333333-3333-3333-3333-333333333333', 500.00, 'em_aberto', 'pendente', 'aprovado',
  'os_direta', 'escala_direta', 1,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true,
  'f0000000-0000-0000-0000-000000000001'
);
-- SEM titulo para item 3 (intencionalmente)

-- 1.5 Atualizar fechamento com valor total correto
UPDATE pagamentos_prestadores
SET valor_liquido = 1500.00
WHERE id = 'f0000000-0000-0000-0000-000000000001';

-- 1.6 Snapshot ANTES da chamada
CREATE TEMP TABLE _antes_falha AS
SELECT
  (SELECT COUNT(*) FROM financeiro_baixas) AS baixas,
  (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago') AS pagar_pago,
  (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') AS pp_pago,
  (SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000001') AS fech_status;

-- 1.7 Executar RPC (deve falhar no item 3)
DO $$
BEGIN
  BEGIN
    PERFORM * FROM f_confirmar_pagamento_fechamento(
      'f0000000-0000-0000-0000-000000000001'::UUID,
      CURRENT_DATE
    );
    RAISE EXCEPTION 'ESPERAVIDO FALHA: RPC retornou sem erro';
  EXCEPTION WHEN OTHERS THEN
    -- Esperado: exceção do item 3
    RAISE NOTICE 'Exceção capturada (esperada): %', SQLERRM;
  END;
END $$;

-- 1.8 Verificar: NENHUMA alteração persistida
SELECT
  a.baixas AS baixas_antes,
  (SELECT COUNT(*) FROM financeiro_baixas) AS baixas_depois,
  CASE WHEN (SELECT COUNT(*) FROM financeiro_baixas) = a.baixas THEN 'PASS' ELSE 'FAIL' END AS test_baixas,
  a.pagar_pago AS pagar_pago_antes,
  (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago') AS pagar_pago_depois,
  CASE WHEN (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago') = a.pagar_pago THEN 'PASS' ELSE 'FAIL' END AS test_pagar,
  a.pp_pago AS pp_pago_antes,
  (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') AS pp_pago_depois,
  CASE WHEN (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') = a.pp_pago THEN 'PASS' ELSE 'FAIL' END AS test_pp,
  a.fech_status AS fech_antes,
  (SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000001') AS fech_depois,
  CASE WHEN (SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000001') = a.fech_status THEN 'PASS' ELSE 'FAIL' END AS test_fech
FROM _antes_falha a;

-- Verificar itens individualmente
SELECT
  id, status_pagamento,
  CASE WHEN status_pagamento = 'pendente' THEN 'PASS' ELSE 'FAIL' END AS test
FROM pagamentos_prestadores
WHERE fechamento_id = 'f0000000-0000-0000-0000-000000000001'
  AND id <> 'f0000000-0000-0000-0000-000000000001'
ORDER BY id;

-- ═══════════════════════════════════════════════════════════════
-- TESTE 2: SUCESSO 3/3
-- ═══════════════════════════════════════════════════════════════

-- 2.1 Criar novo fechamento com 3 itens válidos
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa
) VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  NULL, 2400.00, 'em_aberto', 'pendente', 'aprovado',
  'fechamento', ' teste', 0,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true
);

-- 3 itens com titulos correspondentes
INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id)
VALUES ('f0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', '11122233344', '44444444-4444-4444-4444-444444444444', 800.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000002');
INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao)
VALUES ('10000000-0000-0000-0000-000000000021', '44444444-4444-4444-4444-444444444444', 800.00, 'pendente', 'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Item A');

INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id)
VALUES ('f0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', '11122233344', '55555555-5555-5555-5555-555555555555', 800.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000002');
INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao)
VALUES ('10000000-0000-0000-0000-000000000022', '55555555-5555-5555-5555-555555555555', 800.00, 'pendente', 'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Item B');

INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id)
VALUES ('f0000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', '11122233344', '66666666-6666-6666-6666-666666666666', 800.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000002');
INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao)
VALUES ('10000000-0000-0000-0000-000000000023', '66666666-6666-6666-6666-666666666666', 800.00, 'pendente', 'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Item C');

-- 2.2 Executar RPC
SELECT * FROM f_confirmar_pagamento_fechamento(
  'f0000000-0000-0000-0000-000000000002'::UUID,
  CURRENT_DATE
);

-- 2.3 Verificar resultados
SELECT
  (SELECT COUNT(*) FROM financeiro_baixas WHERE titulo_id IN ('10000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000023')) AS baixas_criadas,
  (SELECT COUNT(*) FROM financeiro_pagar WHERE id IN ('10000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000023') AND status = 'pago') AS titulos_pagos,
  (SELECT COUNT(*) FROM pagamentos_prestadores WHERE fechamento_id = 'f0000000-0000-0000-0000-000000000002' AND status_pagamento = 'pago') AS itens_pagos,
  (SELECT status_pagamento FROM pagamentos_prestadores WHERE id = 'f0000000-0000-0000-0000-000000000002') AS fechamento_status;

-- ═══════════════════════════════════════════════════════════════
-- TESTE 3: IDEMPOTÊNCIA
-- ═══════════════════════════════════════════════════════════════

-- 3.1 Snapshot antes
CREATE TEMP TABLE _antes_idem AS
SELECT (SELECT COUNT(*) FROM financeiro_baixas) AS baixas;

-- 3.2 Executar RPC novamente sobre fechamento já pago
SELECT * FROM f_confirmar_pagamento_fechamento(
  'f0000000-0000-0000-0000-000000000002'::UUID,
  CURRENT_DATE
);

-- 3.3 Verificar: ZERO novas baixas
SELECT
  a.baixas AS baixas_antes,
  (SELECT COUNT(*) FROM financeiro_baixas) AS baixas_depois,
  CASE WHEN (SELECT COUNT(*) FROM financeiro_baixas) = a.baixas THEN 'PASS' ELSE 'FAIL' END AS test_idempotencia
FROM _antes_idem a;

-- ═══════════════════════════════════════════════════════════════
-- TESTE 4: CONCORRÊNCIA (2 sessões)
-- ═══════════════════════════════════════════════════════════════

-- 4.1 Criar fechamento para teste de concorrência
INSERT INTO pagamentos_prestadores (
  id, prestador_id, prestador_nome, prestador_documento,
  os_id, valor_liquido, status, status_pagamento, status_aprovacao,
  tipo_pagamento, origem_lancamento, quantidade_os,
  periodo_inicio, periodo_fim, competencia,
  data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa
) VALUES (
  'f0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000001',
  'Prestador Teste 02H2', '11122233344',
  NULL, 1000.00, 'em_aberto', 'pendente', 'aprovado',
  'fechamento', ' teste', 0,
  CURRENT_DATE, CURRENT_DATE, CURRENT_DATE,
  CURRENT_DATE + 30, true, true
);

INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, status, status_pagamento, status_aprovacao, tipo_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, competencia, data_prevista_pagamento, impacto_dre, impacto_fluxo_caixa, fechamento_id)
VALUES ('f0000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', '11122233344', '77777777-7777-7777-7777-777777777777', 1000.00, 'em_aberto', 'pendente', 'aprovado', 'os_direta', 'escala_direta', 1, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 30, true, true, 'f0000000-0000-0000-0000-000000000003');
INSERT INTO financeiro_pagar (id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome, data_vencimento, descricao)
VALUES ('10000000-0000-0000-0000-000000000031', '77777777-7777-7777-7777-777777777777', 1000.00, 'pendente', 'Prestador Teste 02H2', 'b0000000-0000-0000-0000-000000000001', 'Prestador Teste 02H2', CURRENT_DATE + 30, 'Repasse Concorrencia');

-- 4.2 Sessão A: inicia transação, chama RPC, segura lock
-- 4.3 Sessão B: inicia transação, tenta RPC, aguarda lock
-- (executado via script Node.js com 2 conexões pg separadas)

-- ═══════════════════════════════════════════════════════════════
-- TESTE 5: REGRESSÃO 02H.1
-- ═══════════════════════════════════════════════════════════════

-- Verificar schema 02H.1 intacto
SELECT
  CASE WHEN data_type = 'uuid' THEN 'PASS' ELSE 'FAIL' END AS test_composicao_os_id_uuid
FROM information_schema.columns
WHERE table_name = 'composicao_financeira_os' AND column_name = 'os_id';

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _antes_falha;
DROP TABLE IF EXISTS _antes_idem;
DROP FUNCTION IF EXISTS _cnt;
