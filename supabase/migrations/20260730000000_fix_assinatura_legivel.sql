-- FIX: Colunas comerciais e fiscais ausentes na tabela clientes
-- O arquivo sql/migration_cliente_comercial_fiscal.sql nunca foi executado como migration
-- Adiciona colunas usadas pelo dbMappers.ts e ClienteDetalhe.tsx

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

-- 3. COLUNA DE RELACIONAMENTO
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tabela_valores_padrao_id uuid REFERENCES tabelas_valores(id) ON DELETE SET NULL;

COMMENT ON COLUMN clientes.tipo_cobranca IS 'Tipo de cobranca padrao: quinzenal, mensal, por_cte';
COMMENT ON COLUMN clientes.vencimento_padrao IS 'Dias para vencimento padrao';
COMMENT ON COLUMN clientes.agrupamento_faturamento IS 'Agrupamento de faturamento: por CT-e, por OS, por periodo';
COMMENT ON COLUMN clientes.tomador IS 'Tomador padrao para NF-e/CT-e';
COMMENT ON COLUMN clientes.cnae IS 'CNAE padrao do cliente';
COMMENT ON COLUMN clientes.cfop_padrao IS 'CFOP padrao para operacoes';
COMMENT ON COLUMN clientes.retencoes IS 'Regras de retencao de impostos';
COMMENT ON COLUMN clientes.envio_xml IS 'Envio de XML/NFe por email';
COMMENT ON COLUMN clientes.observacoes_fiscais IS 'Observacoes fiscais por operacao';
COMMENT ON COLUMN clientes.municipio_padrao IS 'Municipio padrao para emissao fiscal';
COMMENT ON COLUMN clientes.regime_tributario IS 'Regime tributario: simples, lucro_presumido, lucro_real, mei';
COMMENT ON COLUMN clientes.aliquota_iss IS 'Aliquota de ISS padrao';
COMMENT ON COLUMN clientes.incentivo_fiscal IS 'Possui incentivo fiscal';
COMMENT ON COLUMN clientes.tabela_valores_padrao_id IS 'Tabela de valores padrao vinculada ao cliente';
