-- ============================================================
-- TESTE MISSAO 129-C: reembolsos_prestador
-- Executar no Supabase SQL Editor APOS aplicar a migration
-- ============================================================

-- ============================================================
-- TESTE 1: TABELA EXISTE
-- ============================================================
SELECT 'TESTE 1: Tabela existe' AS teste;
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
) AS tabela_existe;

-- ============================================================
-- TESTE 2: COLUNAS
-- ============================================================
SELECT 'TESTE 2: Colunas' AS teste;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
ORDER BY ordinal_position;

-- ============================================================
-- TESTE 3: INDICES
-- ============================================================
SELECT 'TESTE 3: Indices' AS teste;
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'reembolsos_prestador'
ORDER BY indexname;

-- ============================================================
-- TESTE 4: TRIGGER
-- ============================================================
SELECT 'TESTE 4: Trigger updated_at' AS teste;
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'reembolsos_prestador';

-- ============================================================
-- TESTE 5: RLS POLICIES
-- ============================================================
SELECT 'TESTE 5: RLS Policies' AS teste;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'reembolsos_prestador'
ORDER BY policyname;

-- ============================================================
-- TESTE 6: RLS ATIVO
-- ============================================================
SELECT 'TESTE 6: RLS ativo' AS teste;
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'reembolsos_prestador';

-- ============================================================
-- TESTE 7: GRANTS
-- ============================================================
SELECT 'TESTE 7: Grants' AS teste;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'reembolsos_prestador'
ORDER BY grantee, privilege_type;

-- ============================================================
-- TESTE 8: INSERT COMO AUTHENTICATED (SIMULADO)
-- NOTA: Este teste requer estar logado no Supabase
-- Executar com um usuario autenticado (auth.uid() nao nulo)
-- ============================================================
SELECT 'TESTE 8: Insert como authenticated' AS teste;

-- Para testar manualmente, descomente e execute:
-- INSERT INTO public.reembolsos_prestador (
--     prestador, os_id, tipo, descricao, valor, data_despesa
-- ) VALUES (
--     'PRESTADOR TESTE',
--     NULL,
--     'pedagio',
--     'Teste de insercao M129C',
--     150.00,
--     CURRENT_DATE
-- )
-- RETURNING id, prestador, tipo, valor, status, created_by, tenant_id, created_at;

-- ============================================================
-- TESTE 9: SELECT COMO ANON (SIMULADO)
-- ============================================================
SELECT 'TESTE 9: Select como anon' AS teste;
-- SELECT * FROM public.reembolsos_prestador LIMIT 5;

-- ============================================================
-- TESTE 10: ISOLAMENTO MULTI-TENANT
-- ============================================================
SELECT 'TESTE 10: Isolamento tenant' AS teste;
-- SELECT tenant_id, COUNT(*) as total
-- FROM public.reembolsos_prestador
-- GROUP BY tenant_id;

-- ============================================================
-- TESTE 11: SCHEMA CACHE
-- ============================================================
SELECT 'TESTE 11: Schema cache' AS teste;
-- Verificar se o schema cache reconhece a tabela:
-- - Notify ja foi enviado pela migration (NOTIFY pgrst, 'reload schema')
-- - Para verificar manualmente:
-- SELECT * FROM public.reembolsos_prestador LIMIT 0;

-- ============================================================
-- TESTE 12: CONSTRAINT CHECK (valor >= 0)
-- ============================================================
SELECT 'TESTE 12: Check valor >= 0' AS teste;
-- Deve falhar:
-- INSERT INTO public.reembolsos_prestador (
--     prestador, tipo, valor, data_despesa
-- ) VALUES (
--     'TESTE', 'pedagio', -100, CURRENT_DATE
-- );

-- ============================================================
-- TESTE 13: CONSTRAINT CHECK (status)
-- ============================================================
SELECT 'TESTE 13: Check status valido' AS teste;
-- Deve falhar:
-- INSERT INTO public.reembolsos_prestador (
--     prestador, tipo, valor, data_despesa, status
-- ) VALUES (
--     'TESTE', 'pedagio', 100, CURRENT_DATE, 'invalido'
-- );

-- ============================================================
-- TESTE 14: INTEGRIDADE FK (os_id)
-- ============================================================
SELECT 'TESTE 14: FK os_id (ON DELETE SET NULL)' AS teste;
-- Se existir uma OS com id 'some-os-id':
-- INSERT INTO public.reembolsos_prestador (
--     prestador, os_id, tipo, valor, data_despesa
-- ) VALUES (
--     'TESTE', 'some-os-id', 'ajudante', 200, CURRENT_DATE
-- );

-- ============================================================
-- TESTE 15: DEFAULT created_by COM auth.uid()
-- ============================================================
SELECT 'TESTE 15: DEFAULT auth.uid()' AS teste;
-- INSERT INTO public.reembolsos_prestador (
--     prestador, tipo, valor, data_despesa
-- ) VALUES (
--     'TESTE DEFAULT AUTH', 'estadia', 300, CURRENT_DATE
-- )
-- RETURNING id, created_by, created_at;

-- ============================================================
-- FIM DOS TESTES
-- ============================================================
