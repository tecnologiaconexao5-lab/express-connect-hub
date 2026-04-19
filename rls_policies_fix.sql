-- ======================================================
-- RLS POLICIES FIX - Sistema TMS Express Connect Hub
-- Executar no Supabase SQL Editor
-- ======================================================

-- 1. CLIENTES - Permissão total para anon key (INSERT, UPDATE, SELECT, DELETE)
-- ======================================================

-- Drop políticas existentes se houver
DROP POLICY IF EXISTS "Permitir INSERT clientes anon" ON clientes;
DROP POLICY IF EXISTS "Permitir UPDATE clientes anon" ON clientes;
DROP POLICY IF EXISTS "Permitir SELECT clientes anon" ON clientes;
DROP POLICY IF EXISTS "Permitir DELETE clientes anon" ON clientes;

-- Criar políticas abertas para clientes (sem autenticação requerida)
CREATE POLICY "Permitir INSERT clientes anon" ON clientes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE clientes anon" ON clientes
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT clientes anon" ON clientes
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE clientes anon" ON clientes
    FOR DELETE USING (true);


-- 2. PRESTADORES - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT prestadores anon" ON prestadores;
DROP POLICY IF EXISTS "Permitir UPDATE prestadores anon" ON prestadores;
DROP POLICY IF EXISTS "Permitir SELECT prestadores anon" ON prestadores;
DROP POLICY IF EXISTS "Permitir DELETE prestadores anon" ON prestadores;

CREATE POLICY "Permitir INSERT prestadores anon" ON prestadores
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE prestadores anon" ON prestadores
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT prestadores anon" ON prestadores
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE prestadores anon" ON prestadores
    FOR DELETE USING (true);


-- 3. VEÍCULOS - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT veiculos anon" ON veiculos;
DROP POLICY IF EXISTS "Permitir UPDATE veiculos anon" ON veiculos;
DROP POLICY IF EXISTS "Permitir SELECT veiculos anon" ON veiculos;
DROP POLICY IF EXISTS "Permitir DELETE veiculos anon" ON veiculos;

CREATE POLICY "Permitir INSERT veiculos anon" ON veiculos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE veiculos anon" ON veiculos
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT veiculos anon" ON veiculos
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE veiculos anon" ON veiculos
    FOR DELETE USING (true);


-- 4. CLIENT_ADDRESSES - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT client_addresses anon" ON client_addresses;
DROP POLICY IF EXISTS "Permitir UPDATE client_addresses anon" ON client_addresses;
DROP POLICY IF EXISTS "Permitir SELECT client_addresses anon" ON client_addresses;
DROP POLICY IF EXISTS "Permitir DELETE client_addresses anon" ON client_addresses;

CREATE POLICY "Permitir INSERT client_addresses anon" ON client_addresses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE client_addresses anon" ON client_addresses
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT client_addresses anon" ON client_addresses
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE client_addresses anon" ON client_addresses
    FOR DELETE USING (true);


-- 5. CLIENT_CONTACTS - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT client_contacts anon" ON client_contacts;
DROP POLICY IF EXISTS "Permitir UPDATE client_contacts anon" ON client_contacts;
DROP POLICY IF EXISTS "Permitir SELECT client_contacts anon" ON client_contacts;
DROP POLICY IF EXISTS "Permitir DELETE client_contacts anon" ON client_contacts;

CREATE POLICY "Permitir INSERT client_contacts anon" ON client_contacts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE client_contacts anon" ON client_contacts
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT client_contacts anon" ON client_contacts
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE client_contacts anon" ON client_contacts
    FOR DELETE USING (true);


-- 6. CLIENT_COMMERCIAL_RULES - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT client_commercial_rules anon" ON client_commercial_rules;
DROP POLICY IF EXISTS "Permitir UPDATE client_commercial_rules anon" ON client_commercial_rules;
DROP POLICY IF EXISTS "Permitir SELECT client_commercial_rules anon" ON client_commercial_rules;
DROP POLICY IF EXISTS "Permitir DELETE client_commercial_rules anon" ON client_commercial_rules;

CREATE POLICY "Permitir INSERT client_commercial_rules anon" ON client_commercial_rules
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE client_commercial_rules anon" ON client_commercial_rules
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT client_commercial_rules anon" ON client_commercial_rules
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE client_commercial_rules anon" ON client_commercial_rules
    FOR DELETE USING (true);


-- 7. PROVIDER_DOCUMENTS - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT provider_documents anon" ON provider_documents;
DROP POLICY IF EXISTS "Permitir UPDATE provider_documents anon" ON provider_documents;
DROP POLICY IF EXISTS "Permitir SELECT provider_documents anon" ON provider_documents;
DROP POLICY IF EXISTS "Permitir DELETE provider_documents anon" ON provider_documents;

CREATE POLICY "Permitir INSERT provider_documents anon" ON provider_documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE provider_documents anon" ON provider_documents
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT provider_documents anon" ON provider_documents
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE provider_documents anon" ON provider_documents
    FOR DELETE USING (true);


-- 8. PROVIDER_EMERGENCY_CONTACTS - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT provider_emergency_contacts anon" ON provider_emergency_contacts;
DROP POLICY IF EXISTS "Permitir UPDATE provider_emergency_contacts anon" ON provider_emergency_contacts;
DROP POLICY IF EXISTS "Permitir SELECT provider_emergency_contacts anon" ON provider_emergency_contacts;
DROP POLICY IF EXISTS "Permitir DELETE provider_emergency_contacts anon" ON provider_emergency_contacts;

CREATE POLICY "Permitir INSERT provider_emergency_contacts anon" ON provider_emergency_contacts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE provider_emergency_contacts anon" ON provider_emergency_contacts
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT provider_emergency_contacts anon" ON provider_emergency_contacts
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE provider_emergency_contacts anon" ON provider_emergency_contacts
    FOR DELETE USING (true);


-- 9. VEHICLE_DOCUMENTS - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT vehicle_documents anon" ON vehicle_documents;
DROP POLICY IF EXISTS "Permitir UPDATE vehicle_documents anon" ON vehicle_documents;
DROP POLICY IF EXISTS "Permitir SELECT vehicle_documents anon" ON vehicle_documents;
DROP POLICY IF EXISTS "Permitir DELETE vehicle_documents anon" ON vehicle_documents;

CREATE POLICY "Permitir INSERT vehicle_documents anon" ON vehicle_documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE vehicle_documents anon" ON vehicle_documents
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT vehicle_documents anon" ON vehicle_documents
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE vehicle_documents anon" ON vehicle_documents
    FOR DELETE USING (true);


-- 10. ORDENS_SERVICO - Permissão total para anon key
-- ======================================================

DROP POLICY IF EXISTS "Permitir INSERT ordens_servico anon" ON ordens_servico;
DROP POLICY IF EXISTS "Permitir UPDATE ordens_servico anon" ON ordens_servico;
DROP POLICY IF EXISTS "Permitir SELECT ordens_servico anon" ON ordens_servico;
DROP POLICY IF EXISTS "Permitir DELETE ordens_servico anon" ON ordens_servico;

CREATE POLICY "Permitir INSERT ordens_servico anon" ON ordens_servico
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir UPDATE ordens_servico anon" ON ordens_servico
    FOR UPDATE USING (true);

CREATE POLICY "Permitir SELECT ordens_servico anon" ON ordens_servico
    FOR SELECT USING (true);

CREATE POLICY "Permitir DELETE ordens_servico anon" ON ordens_servico
    FOR DELETE USING (true);


-- ======================================================
-- VERIFICAÇÃO
-- ======================================================
SELECT 
    schemaname,
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;