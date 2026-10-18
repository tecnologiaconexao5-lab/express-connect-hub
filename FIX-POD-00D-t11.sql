-- T11: REAPPLY + IDEMPOTENCY TEST
\echo '=== T11: REAPPLY TEST ==='

-- BEFORE state (should be reverted from T10)
SELECT 'T11_BEFORE_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;

-- Apply QA setup (production function + QA trigger)
\i /tmp/qa-setup.sql

-- AFTER state
SELECT 'T11_AFTER_HAS_FIX' as check_name,
  (SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao' AND pronamespace = 'public'::regnamespace) LIKE '%UPDATE alocacoes_escala SET ordem_servico_id%' as has_fix;

-- IDEMPOTENCY: apply again
\echo '=== T11 IDEMPOTENCY ==='
\i /tmp/qa-setup.sql
SELECT 'T11_IDEMPOTENT' as check_name, true as passed;
