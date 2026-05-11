CREATE TABLE IF NOT EXISTS sinistros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id TEXT,
    tipo_sinistro TEXT,
    data_evento DATE,
    valor_estimado NUMERIC DEFAULT 0,
    seguradora TEXT,
    status TEXT DEFAULT 'em_analise',
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying active sinistros
CREATE INDEX IF NOT EXISTS idx_sinistros_status ON sinistros(status);
CREATE INDEX IF NOT EXISTS idx_sinistros_os_id ON sinistros(os_id);
