-- ============================================
-- MIGRAÇÃO: ORDEM DE SERVIÇO 100% INTEGRADA
-- Executar no Supabase SQL Editor
-- ============================================

-- ============================================
-- TAREFA 2: COLUNAS FISICAS
-- ============================================

-- Distância e Tempo
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS distancia_km numeric default 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tempo_estimado text;

-- Valores
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_cliente numeric default 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS valor_prestador numeric default 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS margem numeric default 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS percentual_margem numeric default 0;

-- Rota e Mapbox
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS rota_calculada boolean default false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS mapbox_origem text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS mapbox_destino text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS pontos_json jsonb;

-- Status Operacional (padronizado)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS status text default 'rascunho';
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_servico date;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS origem_endereco text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS destino_endereco text;

-- Financeiro
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS financeiro_gerado boolean default false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS recibo_gerado boolean default false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS financeiro_receber_id text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS financeiro_pagar_id text;

-- ============================================
-- TAREFA 8: CAMPOS APP MOTORISTA
-- ============================================

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS motorista_status text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS aceite_motorista boolean default false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_aceite_motorista timestamp with time zone;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_chegada_coleta timestamp with time zone;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_coleta timestamp with time zone;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_chegada_entrega timestamp with time zone;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_entrega timestamp with time zone;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS comprovante_url text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS assinatura_url text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS foto_entrega_url text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS localizacao_entrega_json jsonb;

-- ============================================
-- TAREFA 9: CAMPOS PAINEL CLIENTE
-- ============================================

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS visivel_cliente boolean default true;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS status_cliente text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS link_rastreamento text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS previsao_entrega text;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS mensagem_cliente text;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente);
CREATE INDEX IF NOT EXISTS idx_os_prestador ON ordens_servico(prestador);
CREATE INDEX IF NOT EXISTS idx_os_data_servico ON ordens_servico(data_servico);
CREATE INDEX IF NOT EXISTS idx_os_os_id ON ordens_servico(os_id);

-- ============================================
-- VERIFICAR COLUNAS
-- ============================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ordens_servico'
ORDER BY ordinal_position;

-- ============================================
-- FIM MIGRAÇÃO
-- ============================================

-- Resultado esperado:
-- ✓ Tabela扩展ida com todas as colunas necessárias
-- ✓ Índices criados para performance
-- ✓ Pronto para integrar Mapbox, financeiro, app e painel