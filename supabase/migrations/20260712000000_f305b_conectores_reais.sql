-- ============================================================
-- MIGRATION: 20260712_f305b_conectores_reais
-- F30.5B — CONECTORES UNIVERSAIS: CREDENCIAIS E EXECUÇÃO REAL
-- ============================================================

-- ==================== ALTERAR ENUM: MODO_CONECTOR ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRODUCAO_AUTONOMA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'modo_conector')) THEN
    ALTER TYPE modo_conector ADD VALUE 'PRODUCAO_AUTONOMA';
  END IF;
END $$;

-- ==================== ALTERAR IA_CONECTORES ====================
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS credenciais JSONB DEFAULT '{}';
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS token_validade TIMESTAMPTZ;
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS escopos TEXT[] DEFAULT '{}';
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS limite_uso_dia INTEGER DEFAULT 100;
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS horario_permitido_inicio TIME DEFAULT '06:00:00';
ALTER TABLE ia_conectores ADD COLUMN IF NOT EXISTS horario_permitido_fim TIME DEFAULT '22:00:00';

-- ==================== ALTERAR IA_EXECUCOES_CONECTORES ====================
ALTER TABLE ia_execucoes_conectores ADD COLUMN IF NOT EXISTS tentativa INTEGER DEFAULT 1;
ALTER TABLE ia_execucoes_conectores ADD COLUMN IF NOT EXISTS duracao_ms INTEGER;
ALTER TABLE ia_execucoes_conectores ADD COLUMN IF NOT EXISTS request_url TEXT;
ALTER TABLE ia_execucoes_conectores ADD COLUMN IF NOT EXISTS request_method TEXT;

-- ==================== ALTERAR IA_CONECTOR_ROBO ====================
ALTER TABLE ia_conector_robo ADD COLUMN IF NOT EXISTS limite_uso_dia INTEGER;
ALTER TABLE ia_conector_robo ADD COLUMN IF NOT EXISTS horario_permitido_inicio TIME;
ALTER TABLE ia_conector_robo ADD COLUMN IF NOT EXISTS horario_permitido_fim TIME;

-- ==================== ATUALIZAR SEED: CONECTORES ====================
UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_ZOHO_EMAIL_API_KEY", "env_var_url": "VITE_ZOHO_EMAIL_API_URL", "env_var_from": "VITE_ZOHO_EMAIL_FROM"}'::jsonb,
  escopos = ARRAY['enviar_email', 'listar_emails'],
  limite_uso_dia = 200
WHERE codigo_unico = 'CON_ZOHO_EMAIL' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_EVOLUTION_API_KEY", "instancia": "conexao-express", "env_var_url": "VITE_EVOLUTION_API_URL"}'::jsonb,
  escopos = ARRAY['enviar_mensagem', 'status_conexao', 'buscar_qrcode'],
  limite_uso_dia = 500
WHERE codigo_unico = 'CON_EVOLUTION_WHATSAPP' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_N8N_API_KEY", "env_var_url": "VITE_N8N_WEBHOOK_URL"}'::jsonb,
  escopos = ARRAY['disparar_workflow', 'testar_conexao'],
  limite_uso_dia = 100
WHERE codigo_unico = 'CON_N8N_AUTOMACAO' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_GROQ_API_KEY"}'::jsonb,
  escopos = ARRAY['gerar_resposta', 'testar_conexao'],
  limite_uso_dia = 1000
WHERE codigo_unico = 'CON_GROQ_IA' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_OPENAI_API_KEY"}'::jsonb,
  escopos = ARRAY['gerar_resposta', 'testar_conexao'],
  limite_uso_dia = 500
WHERE codigo_unico = 'CON_OPENAI_IA' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_GEMINI_API_KEY"}'::jsonb,
  escopos = ARRAY['gerar_resposta', 'testar_conexao'],
  limite_uso_dia = 500
WHERE codigo_unico = 'CON_GEMINI_IA' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_CLAUDE_API_KEY"}'::jsonb,
  escopos = ARRAY['gerar_resposta', 'testar_conexao'],
  limite_uso_dia = 500
WHERE codigo_unico = 'CON_CLAUDE_IA' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_token": "VITE_MAPBOX_ACCESS_TOKEN"}'::jsonb,
  escopos = ARRAY['geolocalizar', 'calcular_rota'],
  limite_uso_dia = 1000
WHERE codigo_unico = 'CON_MAPBOX' AND credenciais = '{}'::jsonb;

UPDATE ia_conectores SET
  credenciais = '{"env_var_api_key": "VITE_VAGAS_API_KEY"}'::jsonb,
  escopos = ARRAY['publicar_vaga', 'atualizar_vaga', 'listar_vagas'],
  limite_uso_dia = 50
WHERE codigo_unico = 'CON_RECRUTAMENTO_VAGAS' AND credenciais = '{}'::jsonb;

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_conectores_provedor_tipo ON ia_conectores (provedor, tipo);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_tentativa ON ia_execucoes_conectores (tentativa);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_duracao ON ia_execucoes_conectores (duracao_ms);
