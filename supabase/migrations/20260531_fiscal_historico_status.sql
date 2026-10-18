-- ============================================================
-- MIGRATION: Historico de status fiscal
-- Tabela para rastrear ciclo de vida dos documentos fiscais
-- Data: 2026-05-31
-- ============================================================

CREATE TABLE IF NOT EXISTS fiscal_historico_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_tipo TEXT NOT NULL,
    documento_id UUID NOT NULL,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    motivo TEXT,
    usuario TEXT,
    origem TEXT DEFAULT 'simulacao_interna',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE fiscal_historico_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON fiscal_historico_status;
DROP POLICY IF EXISTS "Allow all operations" ON fiscal_historico_status;
CREATE POLICY "Allow all operations" ON fiscal_historico_status FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fiscal_historico_status_doc ON fiscal_historico_status(documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_historico_status_data ON fiscal_historico_status(created_at DESC);


