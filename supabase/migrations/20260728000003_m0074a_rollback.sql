-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — MISSÃO TMS-007.4A
-- Remove a policy de UPDATE adicionada em ordens_servico.
--
-- Efeito: ordens_servico volta ao estado anterior (sem UPDATE policy),
--         bloqueando toda tentativa de UPDATE via Supabase Client.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "os_update_tms" ON ordens_servico;

-- Garantir que as policies originais NÃO foram afetadas
-- (DROP POLICY IF EXISTS não falha se a policy não existe)
DO $$
DECLARE
  v_policies TEXT;
BEGIN
  SELECT string_agg(policyname || ' (' || cmd || ')', ', ' ORDER BY cmd, policyname)
    INTO v_policies
  FROM pg_policies
  WHERE tablename = 'ordens_servico';

  RAISE NOTICE '=== ROLLBACK TMS-007.4A — Policies remanescentes ===';
  RAISE NOTICE '%', v_policies;
  RAISE NOTICE '=== FIM ===';
END $$;

COMMIT;
