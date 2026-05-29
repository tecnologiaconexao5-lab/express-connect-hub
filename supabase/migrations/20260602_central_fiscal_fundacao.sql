-- 1. fiscal_nfse
CREATE TABLE IF NOT EXISTS fiscal_nfse (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filial_id UUID REFERENCES filiais(id),
    cliente_id UUID REFERENCES clientes(id),
    ordem_servico_id UUID REFERENCES ordens_servico(id),
    numero VARCHAR(50),
    chave_acesso VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    valor DECIMAL(15, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    xml_url TEXT,
    pdf_url TEXT,
    protocolo VARCHAR(100),
    motivo_rejeicao TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. fiscal_ctes
CREATE TABLE IF NOT EXISTS fiscal_ctes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filial_id UUID REFERENCES filiais(id),
    cliente_id UUID REFERENCES clientes(id),
    ordem_servico_id UUID REFERENCES ordens_servico(id),
    numero VARCHAR(50),
    chave_acesso VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    valor DECIMAL(15, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    xml_url TEXT,
    pdf_url TEXT,
    protocolo VARCHAR(100),
    motivo_rejeicao TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. fiscal_mdfes
CREATE TABLE IF NOT EXISTS fiscal_mdfes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filial_id UUID REFERENCES filiais(id),
    cliente_id UUID REFERENCES clientes(id),
    ordem_servico_id UUID REFERENCES ordens_servico(id),
    numero VARCHAR(50),
    chave_acesso VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente',
    valor DECIMAL(15, 2),
    data_emissao TIMESTAMP WITH TIME ZONE,
    xml_url TEXT,
    pdf_url TEXT,
    protocolo VARCHAR(100),
    motivo_rejeicao TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. fiscal_events
CREATE TABLE IF NOT EXISTS fiscal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_tipo VARCHAR(20) NOT NULL, -- 'NFSE', 'CTE', 'MDFE'
    documento_id UUID NOT NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    descricao TEXT,
    protocolo VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. fiscal_logs
CREATE TABLE IF NOT EXISTS fiscal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidade_tipo VARCHAR(50), -- ex: 'NFSE', 'CTE' ou 'API_FOCUS'
    entidade_id UUID,
    acao VARCHAR(100) NOT NULL,
    request JSONB,
    response JSONB,
    status_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_status ON fiscal_nfse(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_cliente_id ON fiscal_nfse(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_os_id ON fiscal_nfse(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_data_emissao ON fiscal_nfse(data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_chave_acesso ON fiscal_nfse(chave_acesso);

CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_status ON fiscal_ctes(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_cliente_id ON fiscal_ctes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_os_id ON fiscal_ctes(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_data_emissao ON fiscal_ctes(data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_chave_acesso ON fiscal_ctes(chave_acesso);

CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_status ON fiscal_mdfes(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_cliente_id ON fiscal_mdfes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_os_id ON fiscal_mdfes(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_data_emissao ON fiscal_mdfes(data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_chave_acesso ON fiscal_mdfes(chave_acesso);

CREATE INDEX IF NOT EXISTS idx_fiscal_events_doc ON fiscal_events(documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_logs_entidade ON fiscal_logs(entidade_tipo, entidade_id);

-- RLS
ALTER TABLE fiscal_nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_ctes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_mdfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for admin/authenticated)
CREATE POLICY "Enable ALL for authenticated users" ON fiscal_nfse FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON fiscal_ctes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON fiscal_mdfes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON fiscal_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable ALL for authenticated users" ON fiscal_logs FOR ALL USING (auth.role() = 'authenticated');

-- Functions/Triggers to update 'updated_at'
CREATE OR REPLACE FUNCTION update_fiscal_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_fiscal_nfse_modtime ON fiscal_nfse;
CREATE TRIGGER update_fiscal_nfse_modtime BEFORE UPDATE ON fiscal_nfse FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_ctes_modtime ON fiscal_ctes;
CREATE TRIGGER update_fiscal_ctes_modtime BEFORE UPDATE ON fiscal_ctes FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_mdfes_modtime ON fiscal_mdfes;
CREATE TRIGGER update_fiscal_mdfes_modtime BEFORE UPDATE ON fiscal_mdfes FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();
