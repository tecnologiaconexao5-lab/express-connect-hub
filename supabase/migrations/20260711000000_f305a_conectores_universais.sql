-- ============================================================
-- MIGRATION: 20260711_f305a_conectores_universais
-- F30.5A — CONECTORES UNIVERSais PARA FUNCIONÁRIOS DIGITAIS
-- ============================================================

-- ==================== TIPOS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_conector') THEN
    CREATE TYPE tipo_conector AS ENUM (
      'EMAIL', 'WHATSAPP', 'CRM', 'IA', 'AUTOMACAO_WEB',
      'REDE_SOCIAL', 'PLATAFORMA_VAGAS', 'FINANCEIRO', 'OUTRO'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modo_conector') THEN
    CREATE TYPE modo_conector AS ENUM (
      'HOMOLOGACAO', 'PRODUCAO_ASSISTIDA', 'PRODUCAO'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_execucao_conector') THEN
    CREATE TYPE status_execucao_conector AS ENUM (
      'SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA',
      'EM_EXECUCAO', 'CONCLUIDA', 'FALHOU', 'CANCELADA'
    );
  END IF;
END $$;

-- ==================== TABELA: CATÁLOGO DE CONECTORES ====================
CREATE TABLE IF NOT EXISTS ia_conectores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_unico TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo tipo_conector NOT NULL,
  provedor TEXT NOT NULL,
  config_default JSONB DEFAULT '{}',
  modo_padrao modo_conector NOT NULL DEFAULT 'HOMOLOGACAO',
  ativo BOOLEAN NOT NULL DEFAULT true,
  url_base TEXT,
  health_check_url TEXT,
  instrucoes_conexao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: VÍNCULO ROBÔ × CONECTOR ====================
CREATE TABLE IF NOT EXISTS ia_conector_robo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  conector_id UUID NOT NULL REFERENCES ia_conectores(id) ON DELETE CASCADE,
  modo modo_conector NOT NULL DEFAULT 'HOMOLOGACAO',
  config_override JSONB DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, conector_id)
);

-- ==================== TABELA: EXECUÇÕES DE CONECTORES ====================
CREATE TABLE IF NOT EXISTS ia_execucoes_conectores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  conector_id UUID NOT NULL REFERENCES ia_conectores(id) ON DELETE CASCADE,
  ferramenta_id UUID REFERENCES ia_ferramentas(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES automacoes_tarefas(id) ON DELETE SET NULL,
  aprovacao_id UUID REFERENCES automacoes_aprovacoes(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  modo_executado modo_conector NOT NULL,
  status status_execucao_conector NOT NULL DEFAULT 'SOLICITADA',
  resultado JSONB DEFAULT '{}',
  erro TEXT,
  request_log JSONB DEFAULT '[]',
  response_log JSONB DEFAULT '{}',
  inicio_execucao TIMESTAMPTZ,
  fim_execucao TIMESTAMPTZ,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_conectores_tipo ON ia_conectores (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_ativo ON ia_conectores (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_provedor ON ia_conectores (provedor);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_codigo ON ia_conectores (codigo_unico);

CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_robo ON ia_conector_robo (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_conector ON ia_conector_robo (conector_id);
CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_ativo ON ia_conector_robo (ativo);

CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_status ON ia_execucoes_conectores (status);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_robo ON ia_execucoes_conectores (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_conector ON ia_execucoes_conectores (conector_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_data ON ia_execucoes_conectores (created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE ia_conectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_conector_robo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_execucoes_conectores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_conectores_select" ON ia_conectores FOR SELECT USING (true);
CREATE POLICY "ia_conectores_insert" ON ia_conectores FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_conectores_update" ON ia_conectores FOR UPDATE USING (true);
CREATE POLICY "ia_conectores_delete" ON ia_conectores FOR DELETE USING (true);

CREATE POLICY "ia_conector_robo_select" ON ia_conector_robo FOR SELECT USING (true);
CREATE POLICY "ia_conector_robo_insert" ON ia_conector_robo FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_conector_robo_update" ON ia_conector_robo FOR UPDATE USING (true);
CREATE POLICY "ia_conector_robo_delete" ON ia_conector_robo FOR DELETE USING (true);

CREATE POLICY "ia_execucoes_conectores_select" ON ia_execucoes_conectores FOR SELECT USING (true);
CREATE POLICY "ia_execucoes_conectores_insert" ON ia_execucoes_conectores FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_execucoes_conectores_update" ON ia_execucoes_conectores FOR UPDATE USING (true);
CREATE POLICY "ia_execucoes_conectores_delete" ON ia_execucoes_conectores FOR DELETE USING (true);

-- ==================== SEED: CONECTORES PADRÃO ====================
INSERT INTO ia_conectores (codigo_unico, nome, descricao, tipo, provedor, config_default, modo_padrao, url_base) VALUES
  ('CON_ZOHO_EMAIL', 'Zoho Mail', 'Serviço de e-mail corporativo via Zoho', 'EMAIL', 'Zoho', '{"permite_envio": true, "permite_recebimento": true}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_EVOLUTION_WHATSAPP', 'Evolution API WhatsApp', 'WhatsApp Business via Evolution API (Baileys)', 'WHATSAPP', 'Evolution API', '{"instancia": "conexao-express", "permite_envio": true, "permite_recebimento": true}'::jsonb, 'HOMOLOGACAO', 'http://localhost:8080'),
  ('CON_N8N_AUTOMACAO', 'n8n Automacao', 'Workflow automation via n8n', 'AUTOMACAO_WEB', 'n8n', '{"webhook_base_url": null}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_GROQ_IA', 'Groq IA (LLaMA)', 'Provedor de IA Groq com LLaMA 3.3 70B', 'IA', 'Groq', '{"modelo": "llama-3.3-70b-versatile", "temperatura": 0.7}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_OPENAI_IA', 'OpenAI GPT', 'Provedor de IA OpenAI GPT-4o-mini', 'IA', 'OpenAI', '{"modelo": "gpt-4o-mini", "temperatura": 0.7}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_GEMINI_IA', 'Google Gemini', 'Provedor de IA Google Gemini', 'IA', 'Google Gemini', '{"modelo": "gemini-2.0-flash", "temperatura": 0.7}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_CLAUDE_IA', 'Anthropic Claude', 'Provedor de IA Anthropic Claude Sonnet', 'IA', 'Anthropic', '{"modelo": "claude-sonnet-4-20250514", "temperatura": 0.7}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_MAPBOX', 'Mapbox', 'API de mapas e geolocalizacão', 'OUTRO', 'Mapbox', '{}'::jsonb, 'HOMOLOGACAO', NULL),
  ('CON_RECRUTAMENTO_VAGAS', 'Plataforma de Vagas', 'Publicacão de vagas em plataformas externas', 'PLATAFORMA_VAGAS', 'Gupy/Indeed', '{}'::jsonb, 'HOMOLOGACAO', NULL)
ON CONFLICT (codigo_unico) DO NOTHING;

-- ==================== VINCULAR CONECTORES A ROBÔS COMERCIAIS (seed inicial) ====================
-- Vincula conectores de comunicacão aos robôs que precisam enviar mensagens
INSERT INTO ia_conector_robo (robo_id, conector_id, modo)
SELECT r.id, c.id, 'HOMOLOGACAO'
FROM automacoes_robos r, ia_conectores c
WHERE r.ativo = true
  AND c.codigo_unico IN ('CON_ZOHO_EMAIL', 'CON_EVOLUTION_WHATSAPP')
  AND r.setor IN ('comercial', 'operacional', 'recrutamento', 'marketing')
  AND NOT EXISTS (
    SELECT 1 FROM ia_conector_robo cr WHERE cr.robo_id = r.id AND cr.conector_id = c.id
  )
ON CONFLICT (robo_id, conector_id) DO NOTHING;
