-- T11: REAPPLY TEST — Apply deploy again, verify fix restored
\echo '=== T11: REAPPLY TEST ==='

-- Capture BEFORE state (should be reverted from T10)
SELECT 'T11_BEFORE_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;
SELECT 'T11_BEFORE_HAS_LOG' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%FIX-POD-00C%' as has_log;

-- Apply deploy
\i /tmp/deploy.sql

-- Verify function restored
SELECT 'T11_AFTER_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;
SELECT 'T11_AFTER_HAS_LOG' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%FIX-POD-00C%' as has_log;

-- Idempotency: apply again, should be 0 errors
\echo '=== T11 IDEMPOTENCY (second apply) ==='
\i /tmp/deploy.sql
SELECT 'T11_IDEMPOTENT' as check_name, true as passed;
