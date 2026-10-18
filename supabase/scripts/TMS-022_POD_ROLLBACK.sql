-- =============================================================================
-- TMS-022 — ROLLBACK DO POD UNIFICADO
-- Remove objetos criados pelo TMS-022_POD_UNIFICADO_CONTROLADO.sql
-- Preserva dados existentes em entregas_protocolo e delivery_proofs
--
-- SEGURANÇA:
--   - DROP trigger primeiro (para de sincronizar)
--   - DROP função depois
--   - Não DROP colunas (ALTER TABLE DROP COLUMN destrói dados)
--   - Não DROP tabelas
--   - Não DELETE registros
-- =============================================================================

-- ============================================================================
-- PRÉ-VALIDAÇÃO
-- ============================================================================
SELECT '=== PRÉ-ROLLBACK ===' as info;
SELECT '1. Trigger existe' as teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid WHERE tg.tgname='trg_sync_delivery_proof_to_entregas') THEN 'EXISTE' ELSE 'AUSENTE' END;
SELECT '2. Função existe' as teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas') THEN 'EXISTE' ELSE 'AUSENTE' END;

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- 1. Remover trigger (para de sincronizar)
DROP TRIGGER IF EXISTS trg_sync_delivery_proof_to_entregas ON public.delivery_proofs;

-- 2. Remover função
DROP FUNCTION IF EXISTS public.f_sync_delivery_proof_to_entregas();

-- 3. Remover policy de SELECT (criada pelo script controlado)
DROP POLICY IF EXISTS "delivery_proofs_select_authenticated" ON public.delivery_proofs;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- As colunas adicionadas (receiver_relationship, gps_accuracy, foto_canhoto_url)
-- NÃO são removidas pois podem conter dados.
-- Se for necessário remover, executar manualmente:
--   ALTER TABLE public.entregas_protocolo DROP COLUMN IF EXISTS receiver_relationship;
--   ALTER TABLE public.entregas_protocolo DROP COLUMN IF EXISTS gps_accuracy;
--   ALTER TABLE public.delivery_proofs DROP COLUMN IF EXISTS foto_canhoto_url;
--   ALTER TABLE public.delivery_proofs DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- PÓS-VALIDAÇÃO
-- ============================================================================
SELECT '=== PÓS-ROLLBACK ===' as info;
SELECT '1. Trigger (deve estar ausente)' as teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON tg.tgrelid=cl.oid WHERE tg.tgname='trg_sync_delivery_proof_to_entregas') THEN 'ERRO: AINDA EXISTE' ELSE 'OK: REMOVIDO' END;
SELECT '2. Função (deve estar ausente)' as teste,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas') THEN 'ERRO: AINDA EXISTE' ELSE 'OK: REMOVIDA' END;
SELECT '3. Tabela delivery_proofs (preservada)' as teste,
       CASE WHEN to_regclass('public.delivery_proofs') IS NOT NULL THEN 'OK: PRESERVADA' ELSE 'ERRO: REMOVIDA' END;
SELECT '4. Tabela entregas_protocolo (preservada)' as teste,
       CASE WHEN to_regclass('public.entregas_protocolo') IS NOT NULL THEN 'OK: PRESERVADA' ELSE 'ERRO: REMOVIDA' END;
SELECT '5. Registros em entregas_protocolo (preservados)' as teste,
       COUNT(*)::text || ' registro(s)' FROM public.entregas_protocolo;
