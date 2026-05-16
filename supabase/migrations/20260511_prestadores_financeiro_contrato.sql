-- Migration: Add financial and contract fields to prestadores table
-- Description: Ensures all necessary fields for financial management and contract generation are present.

ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_diaria numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_km numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_saida numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS fixo_mensal numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_ajudante numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_espera numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_reentrega numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS valor_devolucao numeric;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS banco text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS agencia text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS conta text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS digito text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS tipo_conta text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS favorecido text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS cpf_cnpj_favorecido text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS chave_pix text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS tipo_chave_pix text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS periodicidade_pagamento text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS prazo_pagamento text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS forma_preferencial_pagamento text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS conta_contabil text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS centro_custo text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS retencoes text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS conferencia_manual boolean DEFAULT false;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS observacoes_financeiras text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS franquia_km numeric DEFAULT 0;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS rntrc text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS antt text;

-- Add RNTRC to veiculos table
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS rntrc text;

-- Ensure contratos_gerados has necessary columns
ALTER TABLE contratos_gerados ADD COLUMN IF NOT EXISTS valor_contrato numeric;
ALTER TABLE contratos_gerados ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE contratos_gerados ADD COLUMN IF NOT EXISTS prestador_nome text;
ALTER TABLE contratos_gerados ADD COLUMN IF NOT EXISTS pdf_url text;

-- Add index for performance if not exists
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_prestador_id ON contratos_gerados(prestador_id);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_numero ON contratos_gerados(numero_contrato);
