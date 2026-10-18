-- ============================================================================
-- FIN-SANE-02B — Testes SQL/Integração dos 12 cenários
-- AMBIENTE: QA/HML isolado (NÃO executar em produção)
-- ============================================================================
--
-- Instruções:
-- 1. Aplicar migration 20260913_fin_sane_02b_unifica_valor_pagar.sql
-- 2. Executar este script dentro de uma transação:
--      BEGIN;
--      \i tests/sql/fin_sane_02b_cenarios.sql
--      ROLLBACK;  -- ou COMMIT se quiser persistir dados de teste
--
-- ============================================================================

-- Setup: identificador único para evitar colisão
\set suffix '_fs02b_test_' || extract(epoch from now())::bigint

-- ============================================================================
-- CENÁRIO 1: base sem complemento
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-1', '11111111111', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-1', 'Cliente FS02B-1 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    -- Trigger M66 deve criar fp.valor = 700
    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 700,
        'Cenario 1: fp.valor deve ser 700';

    -- Criar fechamento e pagar
    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-1', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 700, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    ASSERT v_res.sucesso, 'Cenario 1: pagamento deve ter sucesso';
    ASSERT v_res.total_baixas = 1, 'Cenario 1: deve haver 1 baixa';
    ASSERT (SELECT status FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 'pago', 'Cenario 1: fp deve estar pago';

    RAISE NOTICE 'Cenario 1 PASS: base sem complemento';
END $$;

-- ============================================================================
-- CENÁRIO 2: base + pedágio
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-2', '22222222222', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-2', 'Cliente FS02B-2 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 50, 0, 0, 0);

    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 750,
        'Cenario 2: fp.valor deve ser 750 (700 + 50)';

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-2', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 750, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    ASSERT v_res.sucesso, 'Cenario 2: pagamento deve ter sucesso';
    ASSERT v_res.total_baixas = 1, 'Cenario 2: deve haver 1 baixa';

    RAISE NOTICE 'Cenario 2 PASS: base + pedagio';
END $$;

-- ============================================================================
-- CENÁRIO 3: base + adicional
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-3', '33333333333', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-3', 'Cliente FS02B-3 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 80, 0, 0);

    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 780,
        'Cenario 3: fp.valor deve ser 780 (700 + 80)';

    RAISE NOTICE 'Cenario 3 PASS: base + adicional';
END $$;

-- ============================================================================
-- CENÁRIO 4: pedágio + adicional
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-4', '44444444444', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-4', 'Cliente FS02B-4 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 50, 80, 0, 0);

    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 830,
        'Cenario 4: fp.valor deve ser 830 (700 + 50 + 80)';

    RAISE NOTICE 'Cenario 4 PASS: pedagio + adicional';
END $$;

-- ============================================================================
-- CENÁRIO 5: desconto
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-5', '55555555555', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-5', 'Cliente FS02B-5 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 100);

    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 600,
        'Cenario 5: fp.valor deve ser 600 (700 - 100)';

    RAISE NOTICE 'Cenario 5 PASS: desconto';
END $$;

-- ============================================================================
-- CENÁRIO 6: combinação créditos/débitos
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-6', '66666666666', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-6', 'Cliente FS02B-6 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 50, 80, 30, 100);

    ASSERT (SELECT ROUND(valor,2) FROM financeiro_pagar WHERE os_id = v_os_id::TEXT) = 760,
        'Cenario 6: fp.valor deve ser 760 (700 + 50 + 80 + 30 - 100)';

    RAISE NOTICE 'Cenario 6 PASS: combinacao creditos/debitos';
END $$;

-- ============================================================================
-- CENÁRIO 7: fechamento com 1 item
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-7', '77777777777', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-7', 'Cliente FS02B-7 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-7', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 700, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    ASSERT v_res.sucesso, 'Cenario 7: pagamento deve ter sucesso';
    ASSERT v_res.itens_processados = 1, 'Cenario 7: 1 item processado';
    ASSERT v_res.total_baixas = 1, 'Cenario 7: 1 baixa';

    RAISE NOTICE 'Cenario 7 PASS: fechamento com 1 item';
END $$;

-- ============================================================================
-- CENÁRIO 8: fechamento com vários itens
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os1 UUID := gen_random_uuid();
    v_os2 UUID := gen_random_uuid();
    v_os3 UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-8', '88888888888', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-8', 'Cliente FS02B-8 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES
        (v_os1, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0),
        (v_os2, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0),
        (v_os3, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-8', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 2100, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id IN (v_os1, v_os2, v_os3);

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    ASSERT v_res.sucesso, 'Cenario 8: pagamento deve ter sucesso';
    ASSERT v_res.itens_processados = 3, 'Cenario 8: 3 itens processados';
    ASSERT v_res.total_baixas = 3, 'Cenario 8: 3 baixas';

    RAISE NOTICE 'Cenario 8 PASS: fechamento com varios itens';
END $$;

-- ============================================================================
-- CENÁRIO 9: segunda execução idempotente
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res1 RECORD;
    v_res2 RECORD;
    v_baixas_antes INTEGER;
    v_baixas_depois INTEGER;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-9', '99999999999', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-9', 'Cliente FS02B-9 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-9', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 700, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    SELECT * INTO v_res1 FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    v_baixas_antes := v_res1.total_baixas;

    SELECT * INTO v_res2 FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    v_baixas_depois := v_res2.total_baixas;

    ASSERT NOT v_res2.sucesso, 'Cenario 9: segunda execucao deve retornar sucesso=false';
    ASSERT v_baixas_depois = 0, 'Cenario 9: segunda execucao nao deve criar baixas';

    RAISE NOTICE 'Cenario 9 PASS: segunda execucao idempotente';
END $$;

-- ============================================================================
-- CENÁRIO 10: item já pago é ignorado
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_item_id UUID;
    v_fechamento_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-10', '10101010101', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-10', 'Cliente FS02B-10 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    SELECT id INTO v_item_id FROM pagamentos_prestadores WHERE os_id = v_os_id;

    -- Marca item como pago diretamente
    UPDATE pagamentos_prestadores SET status_pagamento = 'pago', status = 'pago' WHERE id = v_item_id;
    UPDATE financeiro_pagar SET status = 'pago' WHERE os_id = v_os_id::TEXT;

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-10', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 700, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
    ASSERT v_res.sucesso, 'Cenario 10: pagamento deve ter sucesso';
    ASSERT v_res.itens_ignorados = 1, 'Cenario 10: 1 item ignorado';
    ASSERT v_res.total_baixas = 0, 'Cenario 10: 0 baixas novas';

    RAISE NOTICE 'Cenario 10 PASS: item ja pago ignorado';
END $$;

-- ============================================================================
-- CENÁRIO 11: título inexistente (sem financeiro_pagar)
-- ============================================================================
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_item_id UUID;
    v_res RECORD;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-11', '11111111112', 'ativo');

    -- Cria item sem OS/título
    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-11', 'servico', 'conferido', 'em_aberto', 'pendente', 'em_conferencia', 500, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_item_id;

    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-11', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 500, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE id = v_item_id;

    BEGIN
        SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);
        ASSERT false, 'Cenario 11: deve lancar excecao sem titulo';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Cenario 11 PASS: titulo inexistente gera excecao (correto 02H.2)';
    END;
END $$;

-- ============================================================================
-- CENÁRIO 12: falha parcial gera rollback total
-- ============================================================================
-- Simulado: forçar inconsistency alterando fp.valor para diferente de pp.valor_liquido
DO $$
DECLARE
    v_prestador_id UUID := gen_random_uuid();
    v_cliente_id UUID := gen_random_uuid();
    v_os_id UUID := gen_random_uuid();
    v_fechamento_id UUID;
    v_res RECORD;
    v_fp_pago_antes INTEGER;
    v_fp_pago_depois INTEGER;
    v_pp_pago_antes INTEGER;
    v_pp_pago_depois INTEGER;
BEGIN
    INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES (v_prestador_id, 'Motorista FS02B-12', '12121212121', 'ativo');
    INSERT INTO clientes (id, nome_fantasia, razao_social, status) VALUES (v_cliente_id, 'Cliente FS02B-12', 'Cliente FS02B-12 LTDA', 'ativo');

    INSERT INTO alocacoes_escala (id, cliente_id, prestador_id, status, finalizada, data_escala, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
    VALUES (v_os_id, v_cliente_id, v_prestador_id, 'concluida', true, CURRENT_DATE, 1000, 700, 0, 0, 0, 0);

    -- Cria fechamento com valor divergente para forçar falha de reconciliação
    INSERT INTO pagamentos_prestadores (id, prestador_id, prestador_nome, tipo_pagamento, status_aprovacao, status_conferencia, status_pagamento, status, valor_liquido, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_prestador_id, 'Motorista FS02B-12', 'fechamento', 'aprovado', 'conferido', 'pendente', 'aprovado', 999, CURRENT_DATE, CURRENT_DATE)
    RETURNING id INTO v_fechamento_id;

    UPDATE pagamentos_prestadores SET fechamento_id = v_fechamento_id WHERE os_id = v_os_id;

    v_fp_pago_antes := (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago');
    v_pp_pago_antes := (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago');

    SELECT * INTO v_res FROM f_confirmar_pagamento_fechamento(v_fechamento_id);

    v_fp_pago_depois := (SELECT COUNT(*) FROM financeiro_pagar WHERE status = 'pago');
    v_pp_pago_depois := (SELECT COUNT(*) FROM pagamentos_prestadores WHERE status_pagamento = 'pago');

    ASSERT NOT v_res.sucesso, 'Cenario 12: deve falhar por divergencia';
    ASSERT v_fp_pago_depois = v_fp_pago_antes, 'Cenario 12: nenhum fp deve ser marcado pago';
    ASSERT v_pp_pago_depois = v_pp_pago_antes, 'Cenario 12: nenhum pp deve ser marcado pago';

    RAISE NOTICE 'Cenario 12 PASS: falha parcial gera rollback total';
END $$;

RAISE NOTICE 'FIN-SANE-02B: todos os 12 cenarios SQL/integracao preparados.';
