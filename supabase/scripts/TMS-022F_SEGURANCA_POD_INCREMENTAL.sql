-- =============================================================================
-- TMS-022F — SEGURANÇA POD INCREMENTAL
-- Remove excesso de permissões em delivery_proofs e entregas_protocolo
--
-- INSTRUÇÃO: Executar inteiro uma única vez no Supabase SQL Editor.
-- Nenhuma parte pode ser executada isoladamente.
-- Não interromper no meio da execução.
--
-- Diagnóstico prévio (TMS-022D):
--   delivery_proofs:    anon=ALL, auth=ALL, RLS=ON, policies=0
--   entregas_protocolo: anon=INSERT/UPDATE/DELETE, auth=ALL, RLS=ON, policies=6
--
-- Escopo limitado a:
--   public.delivery_proofs
--   public.entregas_protocolo
--
-- Não altera:
--   Tabelas de negócio
--   Triggers (trg_sync_delivery_proof_to_entregas preservado)
--   Funções (f_sync_delivery_proof_to_entregas preservada)
--   Dados
--   Default privileges globais
--   Auth
--   Storage
-- =============================================================================

-- ============================================================================
-- PRECHECK: Verificar pré-condições
-- Se falhar, aborta sem alterar nada.
-- ============================================================================
DO $$
DECLARE
    v_dp_oid OID; v_ep_oid OID;
    v_trg_exists BOOLEAN; v_func_exists BOOLEAN;
BEGIN
    v_dp_oid := to_regclass('public.delivery_proofs');
    v_ep_oid := to_regclass('public.entregas_protocolo');
    IF v_dp_oid IS NULL THEN RAISE EXCEPTION 'ABORTANDO: public.delivery_proofs nao existe.'; END IF;
    IF v_ep_oid IS NULL THEN RAISE EXCEPTION 'ABORTANDO: public.entregas_protocolo nao existe.'; END IF;

    SELECT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid
        WHERE tg.tgname='trg_sync_delivery_proof_to_entregas' AND cl.relname='delivery_proofs') INTO v_trg_exists;
    IF NOT v_trg_exists THEN RAISE EXCEPTION 'ABORTANDO: trigger trg_sync_delivery_proof_to_entregas nao encontrado (necessario para sincronizacao POD).'; END IF;

    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas' AND pronamespace='public'::regnamespace) INTO v_func_exists;
    IF NOT v_func_exists THEN RAISE EXCEPTION 'ABORTANDO: funcao f_sync_delivery_proof_to_entregas nao encontrada.'; END IF;

    RAISE NOTICE 'PRECHECK OK: delivery_proofs, entregas_protocolo, trigger e funcao existem.';
END $$;

-- ============================================================================
-- 1. DELIVERY_PROOFS — Remover excessos e criar policies
-- ============================================================================
-- Regra de segurança:
--   anon:           NENHUM acesso
--   authenticated:  INSERT (app cria POD) e SELECT (próprios registros)
--   service_role:   ALL (TMS backend)
--   postgres:       ALL (admin)
--
-- driver_id = auth.uid()::text
--   O app Flutter envia auth.uid() como TEXT em DeliveryProofEntity.driverId
--   A coluna driver_id em delivery_proofs é TEXT (migration M108C1)
--   auth.uid()::text converte UUID para TEXT para comparação na policy

REVOKE ALL ON TABLE public.delivery_proofs FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.delivery_proofs FROM authenticated;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='delivery_proofs' AND policyname='dp_insert_authenticated') THEN
        RAISE EXCEPTION 'ABORTANDO: policy dp_insert_authenticated ja existe em delivery_proofs.';
    END IF;
END $$;
CREATE POLICY "dp_insert_authenticated" ON public.delivery_proofs
    FOR INSERT TO authenticated
    WITH CHECK (true);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='delivery_proofs' AND policyname='dp_select_own') THEN
        RAISE EXCEPTION 'ABORTANDO: policy dp_select_own ja existe em delivery_proofs.';
    END IF;
END $$;
CREATE POLICY "dp_select_own" ON public.delivery_proofs
    FOR SELECT TO authenticated
    USING (driver_id = auth.uid()::text);

-- ============================================================================
-- 2. ENTREGAS_PROTOCOLO — Remover excessos
-- ============================================================================
-- Regra de segurança:
--   anon:           NENHUM acesso (remover policy "Anon insert protocolo")
--   authenticated:  SELECT apenas (Portal Cliente lê dados)
--   service_role:   ALL (TMS backend lê e gerencia)
--   postgres:       ALL (admin)
--
-- Trigger SECURITY DEFINER: não afetado (executa como owner/postgres)
-- Leitura do Portal: via supabase-js com token JWT → role authenticated

DROP POLICY IF EXISTS "Anon insert protocolo" ON public.entregas_protocolo;

REVOKE ALL ON TABLE public.entregas_protocolo FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.entregas_protocolo FROM authenticated;

GRANT SELECT ON TABLE public.entregas_protocolo TO authenticated;
GRANT ALL ON TABLE public.entregas_protocolo TO service_role;

-- ============================================================================
-- PÓS-VALIDAÇÃO CONSOLIDADA
-- ============================================================================
SELECT '=== POS-VALIDACAO ==='::text AS etapa;

-- anon sem acesso
SELECT 'anon delivery_proofs'::text AS item,
       CASE WHEN has_table_privilege('anon','public.delivery_proofs','SELECT') THEN 'FALHA' ELSE 'OK' END AS SELECT_,
       CASE WHEN has_table_privilege('anon','public.delivery_proofs','INSERT') THEN 'FALHA' ELSE 'OK' END AS INSERT_,
       CASE WHEN has_table_privilege('anon','public.delivery_proofs','UPDATE') THEN 'FALHA' ELSE 'OK' END AS UPDATE_,
       CASE WHEN has_table_privilege('anon','public.delivery_proofs','DELETE') THEN 'FALHA' ELSE 'OK' END AS DELETE_,
       'Esperado: OK OK OK OK (anon bloqueado)' AS resultado_esperado
UNION ALL
SELECT 'anon entregas_protocolo',
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','SELECT') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','INSERT') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','UPDATE') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('anon','public.entregas_protocolo','DELETE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK OK OK OK (anon bloqueado)'

UNION ALL

-- authenticated: SELECT/INSERT OK, UPDATE/DELETE bloqueado
SELECT 'auth delivery_proofs',
       CASE WHEN has_table_privilege('authenticated','public.delivery_proofs','SELECT') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('authenticated','public.delivery_proofs','INSERT') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('authenticated','public.delivery_proofs','UPDATE') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('authenticated','public.delivery_proofs','DELETE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK OK OK OK (auth: SELECT+INSERT permitido, UPDATE+DELETE bloqueado)'
UNION ALL
SELECT 'auth entregas_protocolo',
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','SELECT') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','INSERT') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','UPDATE') THEN 'FALHA' ELSE 'OK' END,
       CASE WHEN has_table_privilege('authenticated','public.entregas_protocolo','DELETE') THEN 'FALHA' ELSE 'OK' END,
       'Esperado: OK OK OK OK (auth: SELECT permitido, INSERT+UPDATE+DELETE bloqueado)'

UNION ALL

-- service_role: ALL
SELECT 'service_role entrega',
       CASE WHEN has_table_privilege('service_role','public.entregas_protocolo','SELECT') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('service_role','public.entregas_protocolo','INSERT') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('service_role','public.entregas_protocolo','UPDATE') THEN 'OK' ELSE 'FALHA' END,
       CASE WHEN has_table_privilege('service_role','public.entregas_protocolo','DELETE') THEN 'OK' ELSE 'FALHA' END,
       'Esperado: OK OK OK OK (service_role ALL)'

UNION ALL

-- Policies
SELECT 'policies delivery_proofs',
       COUNT(*)::text, '', '', '', 'Esperado: 2 (dp_insert_authenticated, dp_select_own)'
FROM pg_policies WHERE schemaname='public' AND tablename='delivery_proofs'
UNION ALL
SELECT 'policy "Anon insert protocolo"',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='entregas_protocolo' AND policyname='Anon insert protocolo')
            THEN 'FALHA: AINDA EXISTE' ELSE 'OK: REMOVIDA' END,
       '', '', '', 'Esperado: OK: REMOVIDA'

UNION ALL

-- Trigger e função preservados
SELECT 'trigger trg_sync_delivery_proof_to_entregas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid
            WHERE tg.tgname='trg_sync_delivery_proof_to_entregas' AND cl.relname='delivery_proofs')
            THEN 'OK' ELSE 'FALHA' END,
       '', '', '', 'Esperado: OK (preservado)'
UNION ALL
SELECT 'funcao f_sync_delivery_proof_to_entregas',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas' AND pronamespace='public'::regnamespace)
            THEN 'OK' ELSE 'FALHA' END,
       '', '', '', 'Esperado: OK (preservada)';
