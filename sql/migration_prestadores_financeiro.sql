-- Migration: Adicionar colunas financeiras na tabela prestadores
-- Execute este SQL no Supabase SQL Editor

-- Adicionar colunas de valores financeiros
ALTER TABLE prestadores
ADD COLUMN IF NOT EXISTS valor_km numeric(10,2),
ADD COLUMN IF NOT EXISTS valor_saida numeric(10,2),
ADD COLUMN IF NOT EXISTS fixo_mensal numeric(10,2),
ADD COLUMN IF NOT EXISTS valor_ajudante numeric(10,2),
ADD COLUMN IF NOT EXISTS valor_espera numeric(10,2),
ADD COLUMN IF NOT EXISTS valor_reentrega numeric(10,2),
ADD COLUMN IF NOT EXISTS valor_devolucao numeric(10,2),
ADD COLUMN IF NOT EXISTS favorecido text,
ADD COLUMN IF NOT EXISTS forma_preferencial_pagamento text,
ADD COLUMN IF NOT EXISTS retencoes_descontos text;

-- Observações: as colunas abaixo já devem existir:
-- valor_diaria, banco, agencia, conta, digito, tipo_conta, cpf_cnpj_favorecido,
-- chave_pix, tipo_chave_pix, periodicidade_pagamento, prazo_pagamento,
-- conta_contabil, centro_custo, retencoes, observacoes_financeiras, status