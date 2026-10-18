-- ============================================================
-- F37 — INTEGRAÇÕES EXTERNAS REAIS (MODO SEGURO)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_integracao_externa') THEN
    CREATE TYPE status_integracao_externa AS ENUM ('simulada','bloqueada_governanca','bloqueada_identidade','erro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='canal_integracao') THEN
    CREATE TYPE canal_integracao AS ENUM ('whatsapp','email','zoho_mail','crm','leads','google_ads','meta_ads','api_externa','webhook');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='categoria_integracao') THEN
    CREATE TYPE categoria_integracao AS ENUM ('comunicacao','comercial','marketing','operacao');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS ia_integracoes_externas_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  sessao_id UUID REFERENCES ia_sessoes_operacionais(id) ON DELETE SET NULL,
  canal canal_integracao NOT NULL,
  categoria categoria_integracao NOT NULL,
  acao VARCHAR NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  payload_mockado JSONB NOT NULL DEFAULT '{}',
  status status_integracao_externa NOT NULL DEFAULT 'simulada',
  governanca_decisao VARCHAR,
  identidade_status VARCHAR,
  duracao_ms INTEGER,
  erro TEXT,
  origem VARCHAR DEFAULT 'external_integration_engine',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_robo ON ia_integracoes_externas_logs(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_canal ON ia_integracoes_externas_logs(canal);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_status ON ia_integracoes_externas_logs(status);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_criado ON ia_integracoes_externas_logs(created_at DESC);

ALTER TABLE ia_integracoes_externas_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar integracoes externas' AND tablename='ia_integracoes_externas_logs') THEN
    CREATE POLICY "Gerenciar integracoes externas" ON ia_integracoes_externas_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_integracoes_externas_logs TO anon, authenticated;
