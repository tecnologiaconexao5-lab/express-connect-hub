-- Migration: Add pricing columns to tabelas_valores
-- Description: The escala (schedule) module queries tabelas_valores for client-specific
-- pricing based on vehicle type. These columns enable automatic financial calculation
-- for allocations (valor_cliente, valor_prestador, margem, etc.)
ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS cliente TEXT,
  ADD COLUMN IF NOT EXISTS tipo_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS universal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_base NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_km NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS km_franquia INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cliente NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentual_prestador NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_prestador NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fixo_prestador NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_repasse_prestador TEXT DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS markup_desejavel NUMERIC(10,2) DEFAULT 0;
