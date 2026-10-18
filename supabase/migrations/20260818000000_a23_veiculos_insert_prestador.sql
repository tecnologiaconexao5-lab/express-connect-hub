-- ===================================================================
-- A23 — Policy RLS mínima e segura: prestador autenticado (App) insere
--       SOMENTE veículo vinculado ao próprio prestadores.id.
--
-- Project ref: uwrvzsjtpgaifkktpepn (conexao-express-tms) — CONFIRMADO
--
-- Vínculo:  veiculos.prestador_vinculado = prestadores.id
-- Identidade do App: prestadores.auth_user_id = auth.uid()
--
-- Alteração 100% ADITIVA de RLS:
--   - não altera tabelas/colunas;
--   - não remove/modifica policies existentes (TMS e portal preservadas);
--   - não habilita anon;
--   - não permite UPDATE/DELETE;
--   - não usa USING true nem WITH CHECK true.
--
-- O WITH CHECK exige simultaneamente:
--   prestadores.id = veiculos.prestador_vinculado  E
--   prestadores.auth_user_id = auth.uid()
-- Obriga prestador_vinculado preenchido (NULL não satisfaz p.id = NULL),
-- impossibilita inserir veículo de outro prestador.
-- ===================================================================

DROP POLICY IF EXISTS veiculos_insert_prestador ON public.veiculos;

CREATE POLICY veiculos_insert_prestador ON public.veiculos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM prestadores p
            WHERE p.id = veiculos.prestador_vinculado
              AND p.auth_user_id = auth.uid()
        )
    );