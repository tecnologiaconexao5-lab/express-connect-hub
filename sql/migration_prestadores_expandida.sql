-- ============================================================
-- MIGRAÇÃO EXPANSÃO TABELA PRESTADORES + VEICULOS + DOCUMENTOS
-- Aplicar no SQL Editor do Supabase
-- ============================================================

-- 1._expandir_tabela_prestadores
DO $$ 
BEGIN
    -- Verificar e adicionar colunas faltantes em prestadores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'foto') THEN
        ALTER TABLE prestadores ADD COLUMN foto TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'nome_fantasia') THEN
        ALTER TABLE prestadores ADD COLUMN nome_fantasia TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'regiao_principal') THEN
        ALTER TABLE prestadores ADD COLUMN regiao_principal TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'regioes_secundarias') THEN
        ALTER TABLE prestadores ADD COLUMN regioes_secundarias TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_diaria') THEN
        ALTER TABLE prestadores ADD COLUMN valor_diaria NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_km') THEN
        ALTER TABLE prestadores ADD COLUMN valor_km NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_saida') THEN
        ALTER TABLE prestadores ADD COLUMN valor_saida NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'fixo_mensal') THEN
        ALTER TABLE prestadores ADD COLUMN fixo_mensal NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_ajudante') THEN
        ALTER TABLE prestadores ADD COLUMN valor_ajudante NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_espera') THEN
        ALTER TABLE prestadores ADD COLUMN valor_espera NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_reentrega') THEN
        ALTER TABLE prestadores ADD COLUMN valor_reentrega NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'valor_devolucao') THEN
        ALTER TABLE prestadores ADD COLUMN valor_devolucao NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'banco') THEN
        ALTER TABLE prestadores ADD COLUMN banco TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'agencia') THEN
        ALTER TABLE prestadores ADD COLUMN agencia TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'conta') THEN
        ALTER TABLE prestadores ADD COLUMN conta TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'digito') THEN
        ALTER TABLE prestadores ADD COLUMN digito TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'tipo_conta') THEN
        ALTER TABLE prestadores ADD COLUMN tipo_conta TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'cpf_cnpj_favorecido') THEN
        ALTER TABLE prestadores ADD COLUMN cpf_cnpj_favorecido TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'chave_pix') THEN
        ALTER TABLE prestadores ADD COLUMN chave_pix TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'tipo_chave_pix') THEN
        ALTER TABLE prestadores ADD COLUMN tipo_chave_pix TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'periodicidade_pagamento') THEN
        ALTER TABLE prestadores ADD COLUMN periodicidade_pagamento TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'prazo_pagamento') THEN
        ALTER TABLE prestadores ADD COLUMN prazo_pagamento TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'forma_preferencial_pagamento') THEN
        ALTER TABLE prestadores ADD COLUMN forma_preferencial_pagamento TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'score_interno') THEN
        ALTER TABLE prestadores ADD COLUMN score_interno NUMERIC(3,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'indice_aceite') THEN
        ALTER TABLE prestadores ADD COLUMN indice_aceite NUMERIC(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'indice_comparecimento') THEN
        ALTER TABLE prestadores ADD COLUMN indice_comparecimento NUMERIC(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'indice_entrega_prazo') THEN
        ALTER TABLE prestadores ADD COLUMN indice_entrega_prazo NUMERIC(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'data_cadastro') THEN
        ALTER TABLE prestadores ADD COLUMN data_cadastro DATE;
    END IF;
    
    RAISE NOTICE 'Tabela prestadores expandida com sucesso!';
END $$;

-- 2._expandir_tabela_veiculos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'veiculos' AND column_name = 'tipo_carga') THEN
        ALTER TABLE veiculos ADD COLUMN tipo_carga TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'veiculos' AND column_name = 'temp_min') THEN
        ALTER TABLE veiculos ADD COLUMN temp_min NUMERIC(5,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'veiculos' AND column_name = 'temp_max') THEN
        ALTER TABLE veiculos ADD COLUMN temp_max NUMERIC(5,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'veiculos' AND column_name = 'prestador_vinculado') THEN
        ALTER TABLE veiculos ADD COLUMN prestador_vinculado UUID REFERENCES prestadores(id);
    END IF;
    
    RAISE NOTICE 'Tabela veiculos expandida com sucesso!';
END $$;

-- 3._expandir_tabela_documentos_prestadores
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos_prestadores' AND column_name = 'prestador_id') THEN
        ALTER TABLE documentos_prestadores ADD COLUMN prestador_id UUID REFERENCES prestadores(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos_prestadores' AND column_name = 'validade') THEN
        ALTER TABLE documentos_prestadores ADD COLUMN validade DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos_prestadores' AND column_name = 'analisado_ia') THEN
        ALTER TABLE documentos_prestadores ADD COLUMN analisado_ia BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documentos_prestadores' AND column_name = 'resultado_ia') THEN
        ALTER TABLE documentos_prestadores ADD COLUMN resultado_ia TEXT;
    END IF;
    
    RAISE NOTICE 'Tabela documentos_prestadores expandida com sucesso!';
END $$;

-- ============================================================
-- VALIDAÇÃO: Liste as colunas das tabelas
-- ============================================================

-- Select para validar colunas de prestadores
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prestadores' ORDER BY ordinal_position;

-- Select para validar colunas de veiculos
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'veiculos' ORDER BY ordinal_position;

-- Select para validar colunas de documentos_prestadores
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documentos_prestadores' ORDER BY ordinal_position;