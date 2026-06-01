-- ============================================================
-- MIGRATION: Regras fiscais municipais para NFS-e
-- Tabela para configurar codigo de servico, aliquota ISS e
-- ISS retido por emitente/cliente/municipio.
-- Data: 2026-05-31
-- ============================================================

CREATE TABLE IF NOT EXISTS regras_fiscais_nfse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emitente_id UUID REFERENCES configuracoes_fiscais(id),
    cliente_id UUID REFERENCES clientes(id),
    municipio_prestacao TEXT NOT NULL,
    uf TEXT,
    codigo_servico TEXT NOT NULL,
    descricao_servico TEXT,
    aliquota_iss NUMERIC,
    iss_retido BOOLEAN,
    observacao TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE regras_fiscais_nfse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON regras_fiscais_nfse;
CREATE POLICY "Allow all operations" ON regras_fiscais_nfse FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_regras_fiscais_nfse_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_regras_fiscais_nfse_modtime ON regras_fiscais_nfse;
CREATE TRIGGER update_regras_fiscais_nfse_modtime
    BEFORE UPDATE ON regras_fiscais_nfse
    FOR EACH ROW
    EXECUTE FUNCTION update_regras_fiscais_nfse_updated_at();

CREATE INDEX IF NOT EXISTS idx_regras_fiscais_nfse_ativo ON regras_fiscais_nfse(ativo);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_nfse_municipio ON regras_fiscais_nfse(municipio_prestacao);
