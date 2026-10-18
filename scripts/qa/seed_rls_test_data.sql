-- ============================================================================
-- SEED SINTÉTICO PARA TESTES DE RLS E RECONCILIAÇÃO FINANCEIRA (02M.9 / 02M.10)
-- AMBIENTE ALVO: SUPABASE QA LOCAL (127.0.0.1:54322)
-- ATENÇÃO: NÃO EXECUTAR EM PRODUÇÃO!
-- DADOS 100% FICTÍCIOS / SINTÉTICOS. ZERO DADOS REAIS.
-- ============================================================================
-- UUIDs:
--   Tenant:      00000000-0000-0000-0000-000000000001
--   ADM:         11111111-1111-1111-1111-111111111111
--   Financeiro:  22222222-2222-2222-2222-222222222222
--   Prestador A: 33333333-3333-3333-3333-333333333333
--   Prestador B: 44444444-4444-4444-4444-444444444444
--   Cliente:     55555555-5555-5555-5555-555555555555
--   Conta Cora:  66666666-6666-6666-6666-666666666666
--   OS 1-3:      77777777-7777-7777-7777-00000000000{1,2,3}
--   FP 1-3:      88888888-8888-8888-8888-00000000000{1,2,3}
--   PP 1-3:      99999999-9999-9999-9999-00000000000{1,2,3}
-- ============================================================================

-- SAFETY: block if database looks like production
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='clientes'
               AND (SELECT count(*) FROM clientes) > 50) THEN
        RAISE EXCEPTION 'BLOCKED: PRODUCTION data detected! Aborting.';
    END IF;
END $$;

BEGIN;

-- 1. TENANT (slug is NOT NULL, UNIQUE)
INSERT INTO public.tenants (id, nome, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Teste QA', 'empresa-teste-qa', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- 2. USUÁRIOS (tenant_usuarios)
--    FK: tenant_id -> tenants(id)
--    UNIQUE: (tenant_id, user_id)
--    CHECK: papel IN (super_admin, financeiro, ...)
INSERT INTO public.tenant_usuarios (id, tenant_id, user_id, papel, status)
VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'super_admin', 'ativo'),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'financeiro', 'ativo')
ON CONFLICT (id) DO NOTHING;

-- 3. CLIENTE
INSERT INTO public.clientes (id, tenant_id, nome_fantasia, razao_social, cnpj, status, ie)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000001',
    'CLIENTE TESTE SINTETICO QA LTDA',
    'CLIENTE TESTE SINTETICO QA LTDA',
    '99.999.999/0001-99',
    'ativo',
    'ISENTO'
)
ON CONFLICT (id) DO NOTHING;

-- 4. PRESTADORES (A e B)
INSERT INTO public.prestadores (id, nome_completo, cpf_cnpj, status, tipo_chave_pix, chave_pix, auth_user_id)
VALUES
    ('33333333-3333-3333-3333-333333333333', 'PRESTADOR SINTETICO A (FAKE CESAR)', '000.000.000-01', 'ativo', 'cpf', '000.000.000-01', '33333333-3333-3333-3333-333333333333'),
    ('44444444-4444-4444-4444-444444444444', 'PRESTADOR SINTETICO B (ISOLAMENTO)', '000.000.000-02', 'ativo', 'cpf', '000.000.000-02', '44444444-4444-4444-4444-444444444444')
ON CONFLICT (id) DO NOTHING;

-- 5. CONTA FINANCEIRA (Cora Teste)
--    NOT NULL: nome, tipo, saldo, saldo_inicial, created_at, updated_at
INSERT INTO public.contas_financeiras (id, nome, tipo, banco, agencia, numero_conta, chave_pix, principal, ativa, saldo, saldo_inicial, created_at, updated_at)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    'Banco Cora Sintético QA',
    'corrente',
    '403 - BANCO CORA S.A.',
    '0001',
    '1234567-8',
    'financeiro.teste@conexaoexpress.com.br',
    true,
    true,
    0,
    0,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 6. ORDENS DE SERVIÇO (3 cenários)
--    FK: cliente -> clientes(id), prestador -> prestadores(id)
--    Column: data_servico (NOT data_solicitacao)
INSERT INTO public.ordens_servico (id, tenant_id, cliente, prestador, status, valor_cliente, custo_prestador, data_servico, numero)
VALUES
    ('77777777-7777-7777-7777-000000000001', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'concluida', 1000.00, 600.00, CURRENT_DATE, 'QA-001'),
    ('77777777-7777-7777-7777-000000000002', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'concluida', 1500.00, 900.00, CURRENT_DATE, 'QA-002'),
    ('77777777-7777-7777-7777-000000000003', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'concluida', 2000.00, 1200.00, CURRENT_DATE, 'QA-003')
ON CONFLICT (id) DO NOTHING;

-- 7. FINANCEIRO_PAGAR (FP) — 3 cenários
--    NO tenant_id column on this table
INSERT INTO public.financeiro_pagar (id, os_id, prestador, fornecedor_nome, valor, vencimento, status, descricao)
VALUES
    ('88888888-8888-8888-8888-000000000001', '77777777-7777-7777-7777-000000000001', 'PRESTADOR SINTETICO A (FAKE CESAR)', 'PRESTADOR SINTETICO A (FAKE CESAR)', 600.00, CURRENT_DATE, 'pendente', 'Frete OS QA-001 Integral'),
    ('88888888-8888-8888-8888-000000000002', '77777777-7777-7777-7777-000000000002', 'PRESTADOR SINTETICO A (FAKE CESAR)', 'PRESTADOR SINTETICO A (FAKE CESAR)', 900.00, CURRENT_DATE, 'pendente', 'Frete OS QA-002 Parcial'),
    ('88888888-8888-8888-8888-000000000003', '77777777-7777-7777-7777-000000000003', 'PRESTADOR SINTETICO A (FAKE CESAR)', 'PRESTADOR SINTETICO A (FAKE CESAR)', 1200.00, CURRENT_DATE, 'pendente', 'Frete OS QA-003 Fechamento')
ON CONFLICT (id) DO NOTHING;

-- 8. PAGAMENTOS_PRESTADORES (PP) — 3 cenários
--    Column: valor_servicos (NOT valor_bruto)
INSERT INTO public.pagamentos_prestadores (id, os_id, prestador_id, prestador_nome, valor_servicos, valor_liquido, status, status_pagamento, status_conferencia, periodo_inicio, periodo_fim, data_prevista_pagamento)
VALUES
    ('99999999-9999-9999-9999-000000000001', '77777777-7777-7777-7777-000000000001', '33333333-3333-3333-3333-333333333333', 'PRESTADOR SINTETICO A (FAKE CESAR)', 600.00, 600.00, 'pendente', 'pendente', 'conferido', CURRENT_DATE, CURRENT_DATE, CURRENT_DATE),
    ('99999999-9999-9999-9999-000000000002', '77777777-7777-7777-7777-000000000002', '33333333-3333-3333-3333-333333333333', 'PRESTADOR SINTETICO A (FAKE CESAR)', 900.00, 900.00, 'pendente', 'pendente', 'conferido', CURRENT_DATE, CURRENT_DATE, CURRENT_DATE),
    ('99999999-9999-9999-9999-000000000003', '77777777-7777-7777-7777-000000000003', '33333333-3333-3333-3333-333333333333', 'PRESTADOR SINTETICO A (FAKE CESAR)', 1200.00, 1200.00, 'pendente', 'pendente', 'conferido', CURRENT_DATE, CURRENT_DATE, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- FIM DO SEED SINTÉTICO
-- Total: 1 tenant, 2 usuarios, 1 cliente, 2 prestadores, 1 conta,
--        3 OS, 3 FP, 3 PP = 16 registros
-- ============================================================================
