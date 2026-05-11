-- ============================================================
-- ARQUIVO: sql/integracoes_whatsapp_ia.sql
-- PROJETO: TMS Conexão Express Hub
-- CRIADO EM: 2026-05-01
-- DESCRIÇÃO: Tabelas para integração WhatsApp (Evolution API),
--            conversas, mensagens e logs de IA (Groq/Gemini)
-- INSTRUÇÃO: Execute este script no Supabase SQL Editor.
--            Todas as tabelas usam IF NOT EXISTS — seguro
--            para re-executar sem perder dados.
-- ============================================================

-- ============================================================
-- 1. TABELA: integracoes_config
--    Armazena configurações gerais de integrações (Evolution, n8n, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS integracoes_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL,              -- 'evolution', 'n8n', 'groq', 'gemini'
  nome         text NOT NULL,
  base_url     text,
  api_key      text,                       -- ATENÇÃO: criptografar em produção
  status       text DEFAULT 'pendente',    -- 'pendente', 'ativo', 'erro'
  ativo        boolean DEFAULT true,
  criado_em    timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Índice para busca rápida por tipo
CREATE INDEX IF NOT EXISTS idx_integracoes_config_tipo ON integracoes_config(tipo);

COMMENT ON TABLE integracoes_config IS 'Configurações de integrações externas do TMS (Evolution, n8n, Groq, Gemini)';
COMMENT ON COLUMN integracoes_config.api_key IS 'Chave API — recomenda-se criptografia em produção. Nunca expor via frontend.';

-- ============================================================
-- 2. TABELA: whatsapp_instancias
--    Instâncias do Evolution API configuradas no TMS
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_instancias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,        -- ex: 'recrutamento-conexao-express'
  provider    text DEFAULT 'evolution',
  server_url  text,                        -- ex: http://127.0.0.1:8080
  api_key     text,
  numero      text,                        -- número WhatsApp vinculado
  status      text DEFAULT 'desconectado', -- 'desconectado','conectado','qr_pendente'
  qr_code     text,                        -- base64 do QR code temporário
  webhook_url text,                        -- URL configurada no Evolution
  criado_em   timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instancias_nome ON whatsapp_instancias(nome);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instancias_status ON whatsapp_instancias(status);

COMMENT ON TABLE whatsapp_instancias IS 'Instâncias WhatsApp gerenciadas pelo Evolution API';

-- ============================================================
-- 3. TABELA: whatsapp_conversas
--    Cada conversa ativa com um contato
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_conversas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id      uuid REFERENCES whatsapp_instancias(id) ON DELETE SET NULL,
  telefone          text NOT NULL,
  nome_contato      text,
  tipo_origem       text DEFAULT 'recrutamento', -- 'recrutamento', 'operacao', 'cliente'
  status            text DEFAULT 'aberta',        -- 'aberta', 'fechada', 'aguardando'
  ultima_mensagem   text,
  ultima_interacao  timestamptz,
  criado_em         timestamptz DEFAULT now(),
  atualizado_em     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_telefone ON whatsapp_conversas(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_instancia ON whatsapp_conversas(instancia_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_status ON whatsapp_conversas(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_ultima_interacao ON whatsapp_conversas(ultima_interacao DESC);

COMMENT ON TABLE whatsapp_conversas IS 'Conversas WhatsApp vinculadas às instâncias Evolution API';

-- ============================================================
-- 4. TABELA: whatsapp_mensagens
--    Mensagens individuais de cada conversa
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     uuid REFERENCES whatsapp_conversas(id) ON DELETE CASCADE,
  instancia_id    uuid REFERENCES whatsapp_instancias(id) ON DELETE SET NULL,
  telefone        text NOT NULL,
  direcao         text NOT NULL,           -- 'recebida' | 'enviada'
  mensagem        text,
  tipo_mensagem   text DEFAULT 'text',     -- 'text', 'image', 'audio', 'document'
  raw_payload     jsonb,                   -- payload completo do webhook Evolution
  status          text DEFAULT 'recebida', -- 'recebida', 'enviada', 'entregue', 'lida', 'erro'
  criado_em       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_conversa ON whatsapp_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_telefone ON whatsapp_mensagens(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_instancia ON whatsapp_mensagens(instancia_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_criado_em ON whatsapp_mensagens(criado_em DESC);

COMMENT ON TABLE whatsapp_mensagens IS 'Histórico de mensagens WhatsApp recebidas e enviadas';

-- ============================================================
-- 5. TABELA: ia_logs
--    Logs de chamadas às IAs (Groq, Gemini, Claude)
-- ============================================================
CREATE TABLE IF NOT EXISTS ia_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL,    -- 'groq', 'gemini', 'claude', 'openai'
  origem      text,             -- 'recrutamento', 'operacao', 'chat', 'teste'
  telefone    text,             -- telefone do contato, se aplicável
  prompt      text,
  resposta    text,
  raw_payload jsonb,            -- payload completo enviado e recebido
  criado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_logs_provider ON ia_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ia_logs_criado_em ON ia_logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ia_logs_telefone ON ia_logs(telefone) WHERE telefone IS NOT NULL;

COMMENT ON TABLE ia_logs IS 'Logs de uso das IAs integradas ao TMS (Groq, Gemini, Claude)';

-- ============================================================
-- RLS (Row Level Security)
-- Aplicar apenas se o projeto já usa RLS.
-- Execute os blocos abaixo MANUALMENTE se necessário.
-- ============================================================

-- OPÇÃO A: Desabilitar RLS (mais simples, para ambiente interno)
-- ALTER TABLE integracoes_config DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_instancias DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_conversas DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_mensagens DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ia_logs DISABLE ROW LEVEL SECURITY;

-- OPÇÃO B: Habilitar RLS com policy de acesso autenticado
-- ALTER TABLE integracoes_config ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acesso autenticado" ON integracoes_config
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ALTER TABLE whatsapp_instancias ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acesso autenticado" ON whatsapp_instancias
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ALTER TABLE whatsapp_conversas ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acesso autenticado" ON whatsapp_conversas
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ALTER TABLE whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acesso autenticado" ON whatsapp_mensagens
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ALTER TABLE ia_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acesso autenticado" ON ia_logs
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER: atualizar campo atualizado_em automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas com atualizado_em
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_integracoes_config_atualizado_em'
  ) THEN
    CREATE TRIGGER trg_integracoes_config_atualizado_em
      BEFORE UPDATE ON integracoes_config
      FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_instancias_atualizado_em'
  ) THEN
    CREATE TRIGGER trg_whatsapp_instancias_atualizado_em
      BEFORE UPDATE ON whatsapp_instancias
      FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_conversas_atualizado_em'
  ) THEN
    CREATE TRIGGER trg_whatsapp_conversas_atualizado_em
      BEFORE UPDATE ON whatsapp_conversas
      FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
  END IF;
END $$;

-- ============================================================
-- FIM DO SCRIPT
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================
