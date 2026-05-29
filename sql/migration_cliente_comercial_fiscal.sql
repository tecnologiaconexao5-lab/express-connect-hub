-- =============================================================
-- MIGRAÇÃO: Colunas Comerciais e Fiscais na tabela clientes
-- FASE 2 + FASE 5: Tabela Comercial Real + Base Fiscal
-- Execute no Supabase SQL Editor
-- =============================================================

-- 1. COLUNAS COMERCIAIS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_cobranca text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vencimento_padrao integer DEFAULT 15;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agrupamento_faturamento text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cte_obrigatorio boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS xml_obrigatorio boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS comprovante_obrigatorio boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS canhoto_obrigatorio boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS assinatura_legivel boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS protocolo_obrigatorio boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS geolocalizacao boolean DEFAULT false;

-- 2. COLUNAS FISCAIS
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tomador text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnae text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cfop_padrao text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS retencoes text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS envio_xml boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS observacoes_fiscais text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS municipio_padrao text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS regime_tributario text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS incentivo_fiscal boolean DEFAULT false;

-- 3. COLUNA DE RELACIONAMENTO COM TABELA DE VALORES
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tabela_valores_padrao_id uuid REFERENCES tabelas_valores(id) ON DELETE SET NULL;

COMMENT ON COLUMN clientes.tipo_cobranca IS 'Tipo de cobrança padrão: quinzenal, mensal, por_cte';
COMMENT ON COLUMN clientes.vencimento_padrao IS 'Dias para vencimento padrão';
COMMENT ON COLUMN clientes.agrupamento_faturamento IS 'Agrupamento de faturamento: por CT-e, por OS, por período';
COMMENT ON COLUMN clientes.tomador IS 'Tomador padrão para NF-e/CT-e';
COMMENT ON COLUMN clientes.cnae IS 'CNAE padrão do cliente';
COMMENT ON COLUMN clientes.cfop_padrao IS 'CFOP padrão para operações';
COMMENT ON COLUMN clientes.retencoes IS 'Regras de retenção de impostos';
COMMENT ON COLUMN clientes.envio_xml IS 'Envio de XML/NFe por email';
COMMENT ON COLUMN clientes.observacoes_fiscais IS 'Observações fiscais por operação';
COMMENT ON COLUMN clientes.municipio_padrao IS 'Município padrão para emissão fiscal';
COMMENT ON COLUMN clientes.regime_tributario IS 'Regime tributário: simples, lucro_presumido, lucro_real, mei';
COMMENT ON COLUMN clientes.aliquota_iss IS 'Alíquota de ISS padrão';
COMMENT ON COLUMN clientes.incentivo_fiscal IS 'Possui incentivo fiscal';
COMMENT ON COLUMN clientes.tabela_valores_padrao_id IS 'Tabela de valores padrão vinculada ao cliente';
