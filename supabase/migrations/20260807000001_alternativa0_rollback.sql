-- =============================================================================
-- ROLLBACK — ALTERNATIVA 0: alocacoes_escala
-- Reverte exatamente o que a migration 20260807_alternativa0_minimo_p0 fez.
-- =============================================================================

-- 1. DROP das 5 novas policies (4 TMS + 1 cliente)
DROP POLICY IF EXISTS "ae_select_tms" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "ae_insert_tms" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "ae_update_tms" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "ae_delete_tms" ON public.alocacoes_escala;
DROP POLICY IF EXISTS "ae_select_cliente" ON public.alocacoes_escala;

-- 2. Restaurar grants anon (estado original)
GRANT SELECT ON public.alocacoes_escala TO anon;
GRANT INSERT ON public.alocacoes_escala TO anon;
GRANT UPDATE ON public.alocacoes_escala TO anon;
GRANT DELETE ON public.alocacoes_escala TO anon;

-- 3. Recriar as 4 policies inseguras originais (estado pré-migration)
CREATE POLICY "alocacoes_escala_select_anon" ON public.alocacoes_escala
  FOR SELECT TO public USING (true);

CREATE POLICY "alocacoes_escala_insert_anon" ON public.alocacoes_escala
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "alocacoes_escala_update_anon" ON public.alocacoes_escala
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "alocacoes_escala_update_authenticated" ON public.alocacoes_escala
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- 4. Validação
DO $$
DECLARE
  v_public_policies INTEGER;
  v_anon_grants INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_public_policies
  FROM pg_policies
  WHERE tablename = 'alocacoes_escala'
    AND (roles @> ARRAY['public'::name]);

  SELECT COUNT(*) INTO v_anon_grants
  FROM information_schema.table_privileges
  WHERE table_name = 'alocacoes_escala'
    AND table_schema = 'public'
    AND grantee = 'anon';

  RAISE NOTICE '=== ROLLBACK ALTERNATIVA 0 — alocacoes_escala ===';
  RAISE NOTICE 'Policies com role public: % (deve ser 4)', v_public_policies;
  RAISE NOTICE 'Grants para anon: % (deve ser >0)', v_anon_grants;
  RAISE NOTICE '=== ROLLBACK CONCLUIDO ===';
END;
$$;
