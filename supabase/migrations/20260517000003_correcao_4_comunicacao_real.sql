-- ============================================================
-- MIGRAÇÃO: Central de Comunicação Real (WhatsApp/Email)
-- Correção 4 — 2026-05-17
-- ============================================================

-- ─── 1. crm_conversas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NULL,
  lead_id UUID NULL,
  canal TEXT NOT NULL,
  telefone TEXT NULL,
  email TEXT NULL,
  nome_contato TEXT NULL,
  setor TEXT NULL,
  status TEXT DEFAULT 'aberta',
  ultima_mensagem TEXT NULL,
  ultimo_evento_em TIMESTAMPTZ NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. crm_mensagens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES crm_conversas(id) ON DELETE CASCADE,
  lead_id UUID NULL,
  cliente_id UUID NULL,
  canal TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  direction TEXT NOT NULL,
  remetente TEXT NULL,
  destinatario TEXT NULL,
  mensagem TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  anexo_url TEXT NULL,
  external_id TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  erro TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. crm_templates_mensagem ──────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_templates_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  canal TEXT,
  setor TEXT,
  assunto TEXT NULL,
  mensagem TEXT,
  ativo BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. integracoes_logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integracoes_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao TEXT,
  evento TEXT,
  status TEXT,
  payload JSONB,
  resposta JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_conversas_status ON crm_conversas(status);
CREATE INDEX IF NOT EXISTS idx_crm_conversas_canal ON crm_conversas(canal);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_conversa_id ON crm_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_direction ON crm_mensagens(direction);

-- ─── 6. RLS ──────────────────────────────────────────────────────
ALTER TABLE crm_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_templates_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE integracoes_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_conversas' AND policyname = 'allow_all_crm_conversas') THEN
    CREATE POLICY allow_all_crm_conversas ON crm_conversas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_mensagens' AND policyname = 'allow_all_crm_mensagens') THEN
    CREATE POLICY allow_all_crm_mensagens ON crm_mensagens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_templates_mensagem' AND policyname = 'allow_all_crm_templates_mensagem') THEN
    CREATE POLICY allow_all_crm_templates_mensagem ON crm_templates_mensagem FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integracoes_logs' AND policyname = 'allow_all_integracoes_logs') THEN
    CREATE POLICY allow_all_integracoes_logs ON integracoes_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Inserir templates iniciais
INSERT INTO crm_templates_mensagem (nome, canal, setor, assunto, mensagem) VALUES
('Boas-vindas WhatsApp', 'whatsapp', 'comercial', NULL, 'Olá {{nome}}, seja bem-vindo(a) à Conexão Express! Como podemos ajudar?'),
('Follow-up WhatsApp', 'whatsapp', 'comercial', NULL, 'Olá {{nome}}, passando para saber se teve tempo de avaliar nossa proposta. Podemos agendar uma ligação?'),
('Apresentação Email', 'email', 'comercial', 'Conexão Express — Apresentação Comercial', 'Olá {{nome}}, somos a Conexão Express. Gostaríamos de apresentar nossas soluções logísticas...'),
('Proposta Email', 'email', 'comercial', 'Proposta Comercial - Conexão Express', 'Olá {{nome}}, segue em anexo a nossa proposta comercial...')
ON CONFLICT DO NOTHING;
