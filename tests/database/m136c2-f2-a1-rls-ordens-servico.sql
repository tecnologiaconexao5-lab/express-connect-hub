-- ══════════════════════════════════════════════════════════════════════════════
-- TESTES SQL — F2-A1 RLS ordens_servico
-- Executar APÓS aplicar a migration 20260806_m136c2_f2_a1_fix_rls_ordens_servico.sql
-- ATENÇÃO: requer connection string com service_role para preparação
-- Os testes de segurança devem usar papéis reais (anon, authenticated)
-- ══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- PRÉ-REQUISITO: Configuração do ambiente de teste
-- ============================================================
-- Nota: Este arquivo contém testes conceituais. A execução real
-- depende de ambiente QA com dados controlados.

-- ============================================================
-- TESTE 1: Anon bloqueado
-- ============================================================
-- EXPECT: anon recebe 0 rows (sem policy para anon)
-- REAL: antes da migration → anon via policy os_select_tenant
--       depois da migration → anon sem policy → RLS bloqueia
SET ROLE anon;
SELECT COUNT(*) FROM ordens_servico;  -- EXPECT: 0
RESET ROLE;

-- ============================================================
-- TESTE 2: Usuário autenticado vê OS do seu tenant
-- ============================================================
-- EXPECT: usuário vê apenas OS com tenant_id = seu tenant
SET ROLE authenticated;
-- Simular usuário do tenant 00000000-0000-0000-0000-000000000001
SELECT current_tenant_id_safe();  -- Mostra qual tenant o user atual tem
SELECT COUNT(*) FROM ordens_servico;  -- EXPECT: > 0 (se houver OS no tenant)
RESET ROLE;

-- ============================================================
-- TESTE 3: Registro legado não quebra consulta
-- ============================================================
-- EXPECT: Consulta com LIMIT funciona sem erro de cast UUID
SET ROLE authenticated;
SELECT id, status FROM ordens_servico LIMIT 10;
-- Não deve lançar: invalid input syntax for type uuid
RESET ROLE;

-- ============================================================
-- TESTE 4: Super admin vê OS do tenant
-- ============================================================
-- EXPECT: super_admin vê OS do seu tenant
SET ROLE authenticated;
-- Usar auth.uid() que corresponda a super_admin em tenant_usuarios
SELECT COUNT(*) FROM ordens_servico;  -- EXPECT: mesmo resultado do teste 2
RESET ROLE;

-- ============================================================
-- TESTE 5: COUNT head não quebra
-- ============================================================
SET ROLE authenticated;
SELECT COUNT(*) FROM ordens_servico;  -- EXPECT: sem erro de UUID
RESET ROLE;

-- ============================================================
-- TESTE 6: SELECT por ID funciona para OS do tenant
-- ============================================================
-- Substituir {KNOWN_OS_ID} por um ID real de OS no tenant do usuário
-- SET ROLE authenticated;
-- SELECT id, status FROM ordens_servico WHERE id = '{KNOWN_OS_ID}';
-- RESET ROLE;

-- ============================================================
-- TESTE 7: Tenant diferente não vê OS de outro tenant
-- ============================================================
-- REQUIRE: dados de 2 tenants diferentes no banco
-- SET ROLE authenticated;
-- Simular usuário do tenant alternativo
-- SELECT COUNT(*) FROM ordens_servico;  -- EXPECT: 0 ou diferente do teste 2
-- RESET ROLE;

-- ============================================================
-- TESTE 8: INSERT não foi alterado
-- ============================================================
-- REQUIRE: permissão INSERT + dados controlados
-- BEGIN;
-- INSERT INTO ordens_servico (id, cliente, cliente_id, status, tenant_id)
-- VALUES (gen_random_uuid(), 'TESTE F2-A1', NULL, 'rascunho', current_tenant_id_safe());
-- ROLLBACK;

-- ============================================================
-- TESTE 9: UPDATE não foi alterado
-- ============================================================
-- BEGIN;
-- UPDATE ordens_servico SET observacoes = 'TESTE F2-A1' WHERE id = '{KNOWN_OS_ID}';
-- ROLLBACK;

-- ============================================================
-- TESTE 10: DELETE não foi alterado
-- ============================================================
-- BEGIN;
-- DELETE FROM ordens_servico WHERE id = '{KNOWN_OS_ID}';
-- ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUÇÕES DE EXECUÇÃO
-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Executar migration em ambiente QA
-- 2. Conectar como service_role (preparação)
-- 3. Executar SET ROLE para cada perfil de teste
-- 4. Verificar que os resultados correspondem ao EXPECT
-- 5. Relatar qualquer divergência
-- ══════════════════════════════════════════════════════════════════════════════
