-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-032 — MIGRATION 1 (P0) — CORREÇÃO DO ACEITE VIA REST
-- Policy INSERT exclusiva para o fluxo do prestador em historico_alocacoes_escala.
--
-- ESCOPO: SOMENTE a policy abaixo.
--   - NENHUMA função é alterada (sem CREATE OR REPLACE FUNCTION);
--   - NENHUM REVOKE / GRANT;
--   - NENHUM S1/S2/S9;
--   - NENHUMA mudança em outras tabelas.
--
-- MOTIVO: o aceite/recusa/status do prestador via REST (UPDATE em
-- alocacoes_escala) dispara o trigger INVOKER registrar_historico_alocacao()
-- que faz INSERT em historico_alocacoes_escala. A tabela só possui
-- hae_select_tms + hae_insert_tms (exigem tenant_usuarios.user_id=auth.uid())
-- e não possui tenant_id. Sem policy de prestador, o INSERT falha com
-- 42501 e a transação aborta (403 do TMS-031).
--
-- A policy é RESTRITIVA e garante:
--   1. auth.uid() corresponde a prestadores.auth_user_id;
--   2. o prestador autenticado corresponde ao prestador_id da alocação
--      indicada por historico_alocacoes_escala.alocacao_id;
--   3. a alocação existe (o JOIN exige registro em alocacoes_escala);
--   4. o prestador NÃO pode inserir histórico de alocação de outro prestador;
--   5. a policy existente do TMS (hae_insert_tms) permanece intacta;
--   6. nenhuma permissão UPDATE/DELETE é concedida ao prestador
--      (policy é FOR INSERT apenas).
--
-- IDEMPOTENTE: Sim (DROP POLICY IF EXISTS + CREATE POLICY).
-- ROLLBACK: 20260801_tms032_p0_aceite_policy_rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "hae_insert_prestador" ON public.historico_alocacoes_escala;

CREATE POLICY "hae_insert_prestador" ON public.historico_alocacoes_escala
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.alocacoes_escala ae
      JOIN public.prestadores p ON p.id = ae.prestador_id
      WHERE ae.id = historico_alocacoes_escala.alocacao_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- Validação pós-aplicação:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE schemaname='public' AND tablename='historico_alocacoes_escala' ORDER BY 1;
-- Esperado: hae_insert_prestador (INSERT, authenticated) +
--           hae_insert_tms    (INSERT, authenticated) +
--           hae_select_tms    (SELECT, authenticated).

COMMIT;
