-- T10: ROLLBACK TEST — Apply rollback, verify function reverted
\echo '=== T10: ROLLBACK TEST ==='

-- Capture BEFORE state
SELECT 'T10_BEFORE_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;
SELECT 'T10_BEFORE_HAS_LOG' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%FIX-POD-00C%' as has_log;
SELECT 'T10_BEFORE_TRIGGER' as check_name,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_propagar_financeiro_alocacao') as enabled;

-- Cleanup
DELETE FROM pagamentos_prestadores WHERE os_id LIKE 'aaaaaaaa-%';
DELETE FROM financeiro_pagar WHERE os_id LIKE 'aaaaaaaa-%';
DELETE FROM financeiro_receber WHERE os_id LIKE 'aaaaaaaa-%';
DELETE FROM eventos_oficiais WHERE entity_id::text LIKE 'aaaaaaaa-%';
DELETE FROM ordens_servico WHERE id::text LIKE 'aaaaaaaa-%';
DELETE FROM alocacoes_escala WHERE id::text LIKE 'aaaaaaaa-%';

-- Apply rollback
\i /tmp/rollback.sql

-- Verify function reverted
SELECT 'T10_AFTER_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;
SELECT 'T10_AFTER_HAS_LOG' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%FIX-POD-00C%' as has_log;
SELECT 'T10_AFTER_TRIGGER' as check_name,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_propagar_financeiro_alocacao') as enabled;
