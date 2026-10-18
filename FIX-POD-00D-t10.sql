-- T10: ROLLBACK TEST
\echo '=== T10: ROLLBACK TEST ==='

-- BEFORE state
SELECT 'T10_BEFORE_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;

-- Cleanup
DELETE FROM pagamentos_prestadores WHERE os_id::text LIKE 'aaaaaaaa-%';
DELETE FROM financeiro_pagar WHERE os_id LIKE 'aaaaaaaa-%';
DELETE FROM financeiro_receber WHERE os_id LIKE 'aaaaaaaa-%';
DELETE FROM eventos_oficiais WHERE entity_id::text LIKE 'aaaaaaaa-%';
DELETE FROM ordens_servico WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM alocacoes_escala WHERE id::text LIKE 'aaaaaaaa-%';

-- Apply QA rollback
\i /tmp/qa-rollback.sql

-- AFTER state
SELECT 'T10_AFTER_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;
