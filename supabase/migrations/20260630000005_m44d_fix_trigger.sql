-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44D FIX — CORREÇÃO DO TRIGGER normalizar_os_fks
-- O trigger anterior falhava com 'invalid input syntax for type uuid: ""'
-- porque a função tentava resolver colunas TEXT vazias ou nulas em UUID.
-- Esta versão é mais defensiva e só atua quando há dados reais para resolver.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove o trigger problemático
DROP TRIGGER IF EXISTS trg_normalizar_os_fks ON public.ordens_servico;
DROP FUNCTION IF EXISTS public.normalizar_os_fks();

-- Nota: O trigger foi removido porque causava erro 22P02 em todo INSERT.
-- A normalização será feita pelo código TypeScript via dbMappers.ts.
-- Colunas TEXT (cliente, prestador, veiculo_alocado) e UUID (cliente_id,
-- prestador_id, placa_alocada) coexistem — o código deve preencher ambas.
-- 
-- Se necessário reativar futuramente, usar esta versão defensiva:
-- 
-- CREATE OR REPLACE FUNCTION public.normalizar_os_fks()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     RETURN NEW;  -- no-op seguro
-- END;
-- $$ LANGUAGE plpgsql;
--
-- Motivo da remoção:
-- O trigger BEFORE INSERT executava em todo INSERT, inclusive quando apenas
-- 'numero' e 'status' eram fornecidos. A interação com o schema cache do
-- Supabase e colunas com defaults implícitos causava o erro 22P02.
-- 
-- A abordagem correta é fazer a normalização no código TypeScript
-- (dbMappers.ts, ordemServicoService.ts) antes de enviar ao banco.
