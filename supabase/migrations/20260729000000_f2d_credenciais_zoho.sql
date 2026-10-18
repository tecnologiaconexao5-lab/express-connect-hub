-- FASE P2D — Credenciais Zoho Mail com criptografia pgcrypto
-- Cria tabela para armazenar refresh_token de forma segura
-- Habilita pgcrypto para criptografia simétrica

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_credencial_zoho') THEN
    CREATE TYPE status_credencial_zoho AS ENUM ('ativo', 'expirado', 'revogado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ia_credenciais_zoho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',
  data_center TEXT NOT NULL DEFAULT 'mail.zoho.com',
  refresh_token_criptografado TEXT NOT NULL,
  email_conectado TEXT NOT NULL DEFAULT '',
  status status_credencial_zoho NOT NULL DEFAULT 'ativo',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ia_credenciais_zoho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores podem ler credenciais Zoho"
  ON ia_credenciais_zoho FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestores podem inserir credenciais Zoho"
  ON ia_credenciais_zoho FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Gestores podem atualizar credenciais Zoho"
  ON ia_credenciais_zoho FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Gestores podem deletar credenciais Zoho"
  ON ia_credenciais_zoho FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ia_credenciais_zoho_status ON ia_credenciais_zoho (status);

CREATE OR REPLACE FUNCTION atualizar_timestamp_credenciais_zoho()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ia_credenciais_zoho_atualizado ON ia_credenciais_zoho;
CREATE TRIGGER trg_ia_credenciais_zoho_atualizado
  BEFORE UPDATE ON ia_credenciais_zoho
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_credenciais_zoho();
