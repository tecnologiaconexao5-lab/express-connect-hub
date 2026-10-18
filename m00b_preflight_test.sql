-- FIX-POD-00B: Trigger Preflight Test Suite (Final Version)
-- Tests the FIXED trigger with correct column names and proper setup ordering

-- ============================================================
-- PHASE 0: Ensure test entities exist
-- ============================================================
INSERT INTO clientes (id, nome_fantasia, razao_social, status, tenant_id) VALUES
('55555555-5555-5555-5555-555555555555', 'Cliente QA Test', 'Cliente QA Test LTDA', 'ativo', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET nome_fantasia = 'Cliente QA Test';

INSERT INTO prestadores (id, nome_completo, cpf_cnpj, status) VALUES
('33333333-3333-3333-3333-333333333333', 'Prestador QA Test', '12345678901', 'ativo')
ON CONFLICT (id) DO UPDATE SET nome_completo = 'Prestador QA Test';

-- ============================================================
-- PHASE 1: Clean test data
-- ============================================================
DELETE FROM composicao_financeira_os WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM pagamentos_prestadores WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM financeiro_pagar WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-3333-3333-3333-333333333333', 'aaaaaaaa-4444-4444-4444-444444444444');
DELETE FROM financeiro_receber WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-3333-3333-3333-333333333333', 'aaaaaaaa-4444-4444-4444-444444444444');
DELETE FROM ordens_servico WHERE id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM alocacoes_escala WHERE id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);

-- ============================================================
-- TEST 1: INSERT allocation with values -> OS + financial records
-- ============================================================
INSERT INTO alocacoes_escala (id, empresa_id, cliente_id, prestador_id, data_escala, status, tipo_veiculo, origem, destino, valor_cliente, valor_prestador)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE, 'pendente', 'van', 'SP', 'Campinas', 500, 400);

SELECT 'TEST1_OS_CREATED' as test, EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid) as passed;
SELECT 'TEST1_ALLOC_LINKED' as test, EXISTS(SELECT 1 FROM alocacoes_escala WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid AND ordem_servico_id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid) as passed;
SELECT 'TEST1_RECEBER' as test, EXISTS(SELECT 1 FROM financeiro_receber WHERE os_id = 'aaaaaaaa-1111-1111-1111-111111111111') as passed;
SELECT 'TEST1_PAGAR' as test, EXISTS(SELECT 1 FROM financeiro_pagar WHERE os_id = 'aaaaaaaa-1111-1111-1111-111111111111') as passed;
SELECT 'TEST1_PP' as test, EXISTS(SELECT 1 FROM pagamentos_prestadores WHERE os_id = 'aaaaaaaa-1111-1111-1111-111111111111'::uuid) as passed;

-- ============================================================
-- TEST 2: UPDATE allocation (no values -> add values) -> OS created
-- ============================================================
INSERT INTO alocacoes_escala (id, empresa_id, cliente_id, prestador_id, data_escala, status, tipo_veiculo, origem, destino)
VALUES ('aaaaaaaa-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE, 'pendente', 'van', 'SP', 'Santos');

SELECT 'TEST2_NO_OS_INITIALLY' as test, NOT EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid) as passed;

UPDATE alocacoes_escala SET valor_cliente = 750, valor_prestador = 600 WHERE id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid;

SELECT 'TEST2_OS_CREATED' as test, EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid) as passed;
SELECT 'TEST2_ALLOC_LINKED' as test, EXISTS(SELECT 1 FROM alocacoes_escala WHERE id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid AND ordem_servico_id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid) as passed;
SELECT 'TEST2_RECEBER' as test, EXISTS(SELECT 1 FROM financeiro_receber WHERE os_id = 'aaaaaaaa-2222-2222-2222-222222222222') as passed;
SELECT 'TEST2_PAGAR' as test, EXISTS(SELECT 1 FROM financeiro_pagar WHERE os_id = 'aaaaaaaa-2222-2222-2222-222222222222') as passed;

-- ============================================================
-- TEST 3: CONCLUDED allocation -> composicao_financeira_os created
-- ============================================================
INSERT INTO alocacoes_escala (id, empresa_id, cliente_id, prestador_id, data_escala, status, finalizada, tipo_veiculo, origem, destino, valor_cliente, valor_prestador, data_inicio_real, data_fim_real)
VALUES ('aaaaaaaa-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE, 'concluida', true, 'van', 'SP', 'Campinas', 1000, 800, NOW() - INTERVAL '2 hours', NOW());

SELECT 'TEST3_OS_CREATED' as test, EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid) as passed;
SELECT 'TEST3_RECEBER_ABERTO' as test, (SELECT status FROM financeiro_receber WHERE os_id = 'aaaaaaaa-3333-3333-3333-333333333333') = 'aberto' as passed;
SELECT 'TEST3_PAGAR_ABERTO' as test, (SELECT status FROM financeiro_pagar WHERE os_id = 'aaaaaaaa-3333-3333-3333-333333333333') = 'aberto' as passed;
SELECT 'TEST3_COMPOSICAO' as test, EXISTS(SELECT 1 FROM composicao_financeira_os WHERE os_id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid) as passed;

-- ============================================================
-- TEST 4: RECURSION — UPDATE allocation after conclusion
-- ============================================================
SELECT 'TEST4_OS_COUNT_BEFORE' as test, (SELECT COUNT(*) FROM ordens_servico WHERE id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid) = 1 as passed;

UPDATE alocacoes_escala SET valor_cliente = 1100 WHERE id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid;

SELECT 'TEST4_OS_COUNT_AFTER' as test, (SELECT COUNT(*) FROM ordens_servico WHERE id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid) = 1 as passed;
SELECT 'TEST4_STILL_LINKED' as test, EXISTS(SELECT 1 FROM alocacoes_escala WHERE id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid AND ordem_servico_id = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid) as passed;

-- ============================================================
-- TEST 5: IDEMPOTENCY — Insert with ordem_servico_id pre-set
-- ============================================================
INSERT INTO alocacoes_escala (id, empresa_id, cliente_id, prestador_id, data_escala, status, tipo_veiculo, origem, destino, valor_cliente, valor_prestador, ordem_servico_id)
VALUES ('aaaaaaaa-4444-4444-4444-444444444444'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE, 'pendente', 'van', 'SP', 'Campinas', 300, 250, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid);

SELECT 'TEST5_OS_NOT_DUPLICATED' as test, NOT EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-4444-4444-4444-444444444444'::uuid) as passed;
SELECT 'TEST5_LINK_PRESERVED' as test, (SELECT ordem_servico_id FROM alocacoes_escala WHERE id = 'aaaaaaaa-4444-4444-4444-444444444444'::uuid) = 'aaaaaaaa-3333-3333-3333-333333333333'::uuid as passed;

-- ============================================================
-- CLEANUP
-- ============================================================
DELETE FROM alocacoes_escala WHERE id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM ordens_servico WHERE id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM financeiro_receber WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-3333-3333-3333-333333333333', 'aaaaaaaa-4444-4444-4444-444444444444');
DELETE FROM financeiro_pagar WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-3333-3333-3333-333333333333', 'aaaaaaaa-4444-4444-4444-444444444444');
DELETE FROM pagamentos_prestadores WHERE os_id IN ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-4444-4444-4444-444444444444'::uuid);
DELETE FROM composicao_financeira_os WHERE os_id IN ('aaaaaaaa-3333-3333-3333-333333333333'::uuid);
