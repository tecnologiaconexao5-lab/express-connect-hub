-- ============================================================
-- FIX-CRITICO-FINANCEIRO-E-COTACOES (C3) — 2026-10-13
-- REVOKE dos acessos anon/PUBLIC na RPC f_aceitar_oportunidade_rede.
--
-- Contexto (auditoria TMS-032 S2 / blindagem da rede):
--   A RPC é SECURITY DEFINER e aceita viagens da rede. Grants amplos
--   (PUBLIC/anon) permitem chamada sem autenticação — brecha P1.
--   Esta migration aplica SOMENTE a correção de grants (sem alterar
--   o corpo da função, preservando assinatura e retorno em produção).
--
-- Idempotente e assinatura-agnóstica: varre todos os overloads
-- existentes de f_aceitar_oportunidade_rede em public (produção pode
-- ter a assinatura original de 2 parâmetros — m84 — ou a de 3
-- parâmetros — TMS-032).
--
-- Seguro para produção: apenas REVOKE/GRANT de EXECUTE (DDL de
-- privilégios, sem toque em dados).
-- ============================================================

BEGIN;

DO $$
DECLARE
  reg RECORD;
  qtd integer := 0;
BEGIN
  FOR reg IN
    SELECT p.oid::regprocedure AS assinatura
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'f_aceitar_oportunidade_rede'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', reg.assinatura);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', reg.assinatura);
    qtd := qtd + 1;
    RAISE NOTICE 'Grants atualizados: %', reg.assinatura;
  END LOOP;

  IF qtd = 0 THEN
    RAISE WARNING 'f_aceitar_oportunidade_rede não encontrada em public — nada a revogar.';
  END IF;
END $$;

COMMIT;

-- Verificação pós-aplicação (esperado: 0 linhas para anon/PUBLIC):
-- SELECT p.oid::regprocedure AS fn,
--        p.proacl
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'f_aceitar_oportunidade_rede';
