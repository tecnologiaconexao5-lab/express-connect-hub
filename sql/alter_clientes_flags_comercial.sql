-- =============================================================
-- MIGRAÇÃO: Colunas Comerciais/Operacionais na tabela clientes
-- Execute no Supabase SQL Editor
-- Seguro: usa ADD COLUMN IF NOT EXISTS
-- =============================================================

-- 1. Colunas que o frontend envia mas podem estar faltando na tabela real
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aceita_api          boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aceita_portal       boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS exige_agendamento   boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS exige_sla           boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS exige_portal        boolean DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp            text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsavel_financeiro  text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsavel_operacional text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsavel_comercial   text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS origem_comercial    text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade              text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uf                  text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo                text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS num_os_mes          integer DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- =============================================================
-- 2. Tabela de Endereços do Cliente
-- =============================================================
CREATE TABLE IF NOT EXISTS enderecos_clientes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_endereco    text,
  nome             text,
  cep              text,
  logradouro       text,
  numero           text,
  complemento      text,
  bairro           text,
  cidade           text,
  uf               text,
  latitude         numeric,
  longitude        numeric,
  observacao       text,
  principal        boolean DEFAULT false,
  ativo            boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enderecos_clientes_cliente_id ON enderecos_clientes(cliente_id);

-- RLS permissivo para acesso autenticado
ALTER TABLE enderecos_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_enderecos_clientes" ON enderecos_clientes;
CREATE POLICY "allow_all_enderecos_clientes" ON enderecos_clientes
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- 3. Tabela de Contratos do Cliente
-- =============================================================
CREATE TABLE IF NOT EXISTS clientes_contratos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid REFERENCES clientes(id) ON DELETE CASCADE,
  numero           text,
  tipo             text,
  valor            numeric DEFAULT 0,
  objeto           text,
  vigencia_inicio  date,
  vigencia_fim     date,
  status           text DEFAULT 'ativo',
  observacoes      text,
  anexo_url        text,
  anexo_nome       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_contratos_cliente_id ON clientes_contratos(cliente_id);

-- RLS permissivo para acesso autenticado
ALTER TABLE clientes_contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_clientes_contratos" ON clientes_contratos;
CREATE POLICY "allow_all_clientes_contratos" ON clientes_contratos
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- 4. Garantir RLS permissivo em clientes (para salvar sem auth)
-- =============================================================
DROP POLICY IF EXISTS "allow_all_clientes" ON clientes;
CREATE POLICY "allow_all_clientes" ON clientes
  FOR ALL USING (true) WITH CHECK (true);
