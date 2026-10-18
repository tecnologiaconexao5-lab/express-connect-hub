-- ===================================================================
-- CAD-PERSIST-01 — Policy RLS: prestador autenticado (App) lê o(s)
--                  próprio(s) veículo(s) vinculado(s).
--
-- Project ref: uwrvzsjtpgaifkktpepn (conexao-express-tms)
--
-- Contexto:
--   O App do Prestador precisa exibir o veículo ativo no Perfil/Home.
--   O veículo vive em `veiculos` (vínculo veiculos.prestador_vinculado =
--   prestadores.id), mas não existia policy de SELECT para o prestador —
--   apenas `veiculos_select_tms` (tenant) e `veiculos_select_portal`
--   (cliente). Resultado: o prestador não conseguia ler o próprio veículo.
--
-- Alteração 100% ADITIVA de RLS:
--   - não altera tabelas/colunas;
--   - não remove/modifica policies existentes (TMS e portal preservadas);
--   - não habilita anon;
--   - não permite INSERT/UPDATE/DELETE;
--   - não usa USING true nem WITH CHECK true.
--
-- Espelha a checagem já homologada de `veiculos_insert_prestador`
-- (A23 / 20260818000000): prestadores.id = veiculos.prestador_vinculado
-- E prestadores.auth_user_id = auth.uid(). A subconsulta em `prestadores`
-- é resolvida por `prestadores_select_own` (sem recursão).
-- ===================================================================

DROP POLICY IF EXISTS veiculos_select_prestador ON public.veiculos;

CREATE POLICY veiculos_select_prestador ON public.veiculos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM prestadores p
            WHERE p.id = veiculos.prestador_vinculado
              AND p.auth_user_id = auth.uid()
        )
    );
