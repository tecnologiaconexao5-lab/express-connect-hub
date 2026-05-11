-- ============================================================
-- AUDITORIA ORDEM DE SERVIÇO - ADICIONAR COLUNAS FALTANTES
-- ============================================================

-- Campos Boolean
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS comprovante_obrigatorio BOOLEAN DEFAULT true;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS cte_obrigatorio BOOLEAN DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS xml_obrigatorio BOOLEAN DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS operacao_dedicada BOOLEAN DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS is_reserva BOOLEAN DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS retorno_obrigatorio BOOLEAN DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS notificar_destinatario BOOLEAN DEFAULT true;

-- Campos Text
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS modalidade TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS orcamento_origem TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS veiculo_subcategoria TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS veiculo_carroceria TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS veiculo_termica TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_agendada TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS observacao_agendamento TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_programada TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS janela_operacional TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS previsao_inicio TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS previsao_termino TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tipo_escala TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS instrucoes_operacionais TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS observacao_torre TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tabela_aplicada TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS conta_contabil TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS centro_custo_fin TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS status_faturamento TEXT DEFAULT 'a faturar';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'a pagar';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS email_destinatario TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS whatsapp_destinatario TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS eventos_tracker TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS distancia_rota TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS faixa_aplicada TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS veiculo_sugerido TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS instrucoes_operacionais_os TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS recebedor_nome TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS recebedor_documento TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tempo_estimado TEXT;

-- Campos Numeric
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_cliente NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_prestador NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS pedagio NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS ajudante NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS adicionais NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS descontos NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS reembolso_previsto NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS lucro_estimado NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS margem_lucro NUMERIC;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS distancia_km NUMERIC;

-- Campos JSONB
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS carga JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS enderecos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS localizacao_entrega_json JSONB;

-- ============================================================
-- VERIFICAR ESTRUTURA ATUAL
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'ordens_servico' ORDER BY ordinal_position;