CREATE TABLE IF NOT EXISTS seguros_auto_apolices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seguradora TEXT,
    numero_apolice TEXT,
    tipo_seguro TEXT,
    veiculo_id UUID,
    vigencia_inicio DATE,
    vigencia_fim DATE,
    valor_premio NUMERIC DEFAULT 0,
    forma_pagamento TEXT,
    status TEXT DEFAULT 'ativa',
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying active policies
CREATE INDEX IF NOT EXISTS idx_seguros_apolices_status ON seguros_auto_apolices(status);
CREATE INDEX IF NOT EXISTS idx_seguros_apolices_vigencia ON seguros_auto_apolices(vigencia_fim);
