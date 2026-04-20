-- ======================================================
-- RLS FIX TEMPORÁRIO - Liberar acesso público (anon key)
-- Executar no Supabase SQL Editor
-- ======================================================

-- Verificar se RLS está habilitado nas tabelas
SELECT 'clientes' AS tabela, rowsecurity AS rls_ativado FROM pg_tables WHERE tablename = 'clientes'
UNION ALL
SELECT 'prestadores', rowsecurity FROM pg_tables WHERE tablename = 'prestadores'
UNION ALL
SELECT 'veiculos', rowsecurity FROM pg_tables WHERE tablename = 'veiculos'
UNION ALL
SELECT 'client_addresses', rowsecurity FROM pg_tables WHERE tablename = 'client_addresses'
UNION ALL
SELECT 'client_contacts', rowsecurity FROM pg_tables WHERE tablename = 'client_contacts'
UNION ALL
SELECT 'ordens_servico', rowsecurity FROM pg_tables WHERE tablename = 'ordens_servico';

-- ======================================================
-- 1. CLIENTES
-- ======================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON clientes;
CREATE POLICY "liberar tudo temporario" ON clientes
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- 2. PRESTADORES
-- ======================================================
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON prestadores;
CREATE POLICY "liberar tudo temporario" ON prestadores
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- 3. VEÍCULOS
-- ======================================================
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON veiculos;
CREATE POLICY "liberar tudo temporario" ON veiculos
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- 4. CLIENT_ADDRESSES
-- ======================================================
ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON client_addresses;
CREATE POLICY "liberar tudo temporario" ON client_addresses
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- 5. CLIENT_CONTACTS
-- ======================================================
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON client_contacts;
CREATE POLICY "liberar tudo temporario" ON client_contacts
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- 6. ORDENS_SERVICO
-- ======================================================
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liberar tudo temporario" ON ordens_servico;
CREATE POLICY "liberar tudo temporario" ON ordens_servico
    FOR ALL USING (true)
    WITH CHECK (true);

-- ======================================================
-- VERIFICAÇÃO FINAL
-- ======================================================
SELECT 
    tablename, 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE schemaname = 'public'
AND policyname = 'liberar tudo temporario'
ORDER BY tablename;