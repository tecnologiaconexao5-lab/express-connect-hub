-- ============================================
-- MÓDULO: Pagamento de Prestadores
-- Fase 2: Schema SQL para criação das tabelas
-- ============================================

-- Tabela principal de pagamentos de prestadores
CREATE TABLE IF NOT EXISTS public.pagamentos_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
    prestador_nome TEXT,
    prestador_documento TEXT,
    
    -- Período de referência
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    
    -- Valores calculados
    quantidade_os INTEGER DEFAULT 0,
    valor_servicos NUMERIC(10,2) DEFAULT 0,
    valor_reembolsos NUMERIC(10,2) DEFAULT 0,
    valor_bonus NUMERIC(10,2) DEFAULT 0,
    valor_descontos NUMERIC(10,2) DEFAULT 0,
    valor_adiantamentos NUMERIC(10,2) DEFAULT 0,
    valor_liquido NUMERIC(10,2) DEFAULT 0,
    
    -- dados bancários para pagamento
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    conta_tipo TEXT,
    chave_pix TEXT,
    
    -- Status e datas
    status TEXT DEFAULT 'pendente',
    data_programada_pagamento DATE,
    data_pagamento DATE,
    forma_pagamento TEXT,
    
    -- controle CNAB
    cnab_lote_id TEXT,
    cnab_arquivo TEXT,
    
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de itens do pagamento (vinculado a OS)
CREATE TABLE IF NOT EXISTS public.pagamentos_prestadores_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pagamento_id UUID REFERENCES public.pagamentos_prestadores(id) ON DELETE CASCADE,
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    os_numero TEXT,
    
    -- Valores do serviço
    valor_servico NUMERIC(10,2) DEFAULT 0,
    pedagio NUMERIC(10,2) DEFAULT 0,
    adicional NUMERIC(10,2) DEFAULT 0,
    
    -- Ajustes manuais
    valor_reembolso NUMERIC(10,2) DEFAULT 0,
    valor_bonus NUMERIC(10,2) DEFAULT 0,
    valor_desconto NUMERIC(10,2) DEFAULT 0,
    observacao TEXT,
    
    -- Status
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de adiantamentos
CREATE TABLE IF NOT EXISTS public.adiantamentos_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
    prestador_nome TEXT,
    prestador_documento TEXT,
    
    valor NUMERIC(10,2) NOT NULL,
    tipo TEXT DEFAULT 'adiantamento',
    forma_pagamento TEXT,
    
    referencia TEXT,
    observacoes TEXT,
    
    status TEXT DEFAULT 'pendente',
    data_programada DATE,
    data_pagamento DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.pagamentos_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_prestadores_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adiantamentos_prestadores ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow all on pagamentos_prestadores" ON public.pagamentos_prestadores;
CREATE POLICY "Allow all on pagamentos_prestadores" ON public.pagamentos_prestadores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on pagamentos_prestadores_itens" ON public.pagamentos_prestadores_itens;
CREATE POLICY "Allow all on pagamentos_prestadores_itens" ON public.pagamentos_prestadores_itens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on adiantamentos_prestadores" ON public.adiantamentos_prestadores;
CREATE POLICY "Allow all on adiantamentos_prestadores" ON public.adiantamentos_prestadores FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_prestador ON public.pagamentos_prestadores(prestador_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_periodo ON public.pagamentos_prestadores(periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_status ON public.pagamentos_prestadores(status);

CREATE INDEX IF NOT EXISTS idx_pagamentos_itens_pagamento ON public.pagamentos_prestadores_itens(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_itens_os ON public.pagamentos_prestadores_itens(os_id);

CREATE INDEX IF NOT EXISTS idx_adiantamentos_prestador ON public.adiantamentos_prestadores(prestador_id);
CREATE INDEX IF NOT EXISTS idx_adiantamentos_status ON public.adiantamentos_prestadores(status);