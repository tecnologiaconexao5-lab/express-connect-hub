-- ============================================================================
-- FIX-POD-00D-QA-HARNESS.sql
-- QA environment setup: adds production-compatible columns
-- These are SHIMS for QA only — NOT part of production deploy
-- ============================================================================

-- Add production column names as aliases (valor_frete/valor_repasse)
-- In production these hold the same data as valor_cliente/valor_prestador
ALTER TABLE alocacoes_escala ADD COLUMN IF NOT EXISTS valor_frete numeric;
ALTER TABLE alocacoes_escala ADD COLUMN IF NOT EXISTS valor_repasse numeric;

-- Sync data from QA columns to production column names
UPDATE alocacoes_escala SET valor_frete = valor_cliente WHERE valor_frete IS NULL AND valor_cliente IS NOT NULL;
UPDATE alocacoes_escala SET valor_repasse = valor_prestador WHERE valor_repasse IS NULL AND valor_prestador IS NOT NULL;

-- Verify
SELECT 'QA_SHIMColumns' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='alocacoes_escala' AND column_name='valor_frete') as has_frete,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='alocacoes_escala' AND column_name='valor_repasse') as has_repasse;
