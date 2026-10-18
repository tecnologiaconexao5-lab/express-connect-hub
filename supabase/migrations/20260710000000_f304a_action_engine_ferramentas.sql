-- ============================================================
-- MIGRATION: 20260710_f304a_action_engine_ferramentas
-- F30.4A — ACTION ENGINE DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================

-- ==================== TIPOS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_ferramenta') THEN
    CREATE TYPE categoria_ferramenta AS ENUM (
      'COMUNICACAO', 'MARKETING', 'FINANCEIRO', 'OPERACIONAL',
      'COMERCIAL', 'DOCUMENTOS', 'AUTOMACAO_WEB', 'INTEGRACOES', 'RECRUTAMENTO'
    );
  ELSE
    -- Add RECRUTAMENTO if missing (idempotent)
    ALTER TYPE categoria_ferramenta ADD VALUE IF NOT EXISTS 'RECRUTAMENTO';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_autonomia_ferramenta') THEN
    CREATE TYPE nivel_autonomia_ferramenta AS ENUM (
      'CONSULTA', 'EXECUTAR_COM_APROVACAO', 'EXECUTAR_AUTONOMO'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_execucao_ferramenta') THEN
    CREATE TYPE status_execucao_ferramenta AS ENUM (
      'SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA',
      'EM_EXECUCAO', 'CONCLUIDA', 'FALHOU', 'CANCELADA'
    );
  END IF;
END $$;

-- ==================== TABELA: CATÁLOGO DE FERRAMENTAS ====================
CREATE TABLE IF NOT EXISTS ia_ferramentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_unico TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria categoria_ferramenta NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  precisa_aprovacao BOOLEAN NOT NULL DEFAULT true,
  risco_operacional TEXT NOT NULL DEFAULT 'baixo' CHECK (risco_operacional IN ('baixo', 'medio', 'alto', 'critico')),
  custo_estimado TEXT,
  limite_execucoes_dia INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== TABELA: PERMISSÕES ROBÔ × FERRAMENTA ====================
CREATE TABLE IF NOT EXISTS ia_robo_ferramentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  ferramenta_id UUID NOT NULL REFERENCES ia_ferramentas(id) ON DELETE CASCADE,
  nivel_autonomia nivel_autonomia_ferramenta NOT NULL DEFAULT 'EXECUTAR_COM_APROVACAO',
  limite_diario INTEGER,
  horario_inicio TIME,
  horario_fim TIME,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, ferramenta_id)
);

-- ==================== TABELA: EXECUÇÕES DE FERRAMENTAS ====================
CREATE TABLE IF NOT EXISTS ia_execucoes_ferramentas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  ferramenta_id UUID NOT NULL REFERENCES ia_ferramentas(id) ON DELETE CASCADE,
  tarefa_id UUID REFERENCES automacoes_tarefas(id) ON DELETE SET NULL,
  aprovacao_id UUID REFERENCES automacoes_aprovacoes(id) ON DELETE SET NULL,
  solicitacao TEXT NOT NULL,
  contexto JSONB DEFAULT '{}',
  status status_execucao_ferramenta NOT NULL DEFAULT 'SOLICITADA',
  resultado JSONB DEFAULT '{}',
  erro TEXT,
  inicio_execucao TIMESTAMPTZ,
  fim_execucao TIMESTAMPTZ,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_categoria ON ia_ferramentas (categoria);
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_ativo ON ia_ferramentas (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_codigo ON ia_ferramentas (codigo_unico);

CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_robo ON ia_robo_ferramentas (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_ferramenta ON ia_robo_ferramentas (ferramenta_id);
CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_ativo ON ia_robo_ferramentas (ativo);

CREATE INDEX IF NOT EXISTS idx_ia_execucoes_status ON ia_execucoes_ferramentas (status);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_robo ON ia_execucoes_ferramentas (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramenta ON ia_execucoes_ferramentas (ferramenta_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_data ON ia_execucoes_ferramentas (created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE ia_ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_robo_ferramentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_execucoes_ferramentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_ferramentas_select" ON ia_ferramentas FOR SELECT USING (true);
CREATE POLICY "ia_ferramentas_insert" ON ia_ferramentas FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_ferramentas_update" ON ia_ferramentas FOR UPDATE USING (true);
CREATE POLICY "ia_ferramentas_delete" ON ia_ferramentas FOR DELETE USING (true);

CREATE POLICY "ia_robo_ferramentas_select" ON ia_robo_ferramentas FOR SELECT USING (true);
CREATE POLICY "ia_robo_ferramentas_insert" ON ia_robo_ferramentas FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_robo_ferramentas_update" ON ia_robo_ferramentas FOR UPDATE USING (true);
CREATE POLICY "ia_robo_ferramentas_delete" ON ia_robo_ferramentas FOR DELETE USING (true);

CREATE POLICY "ia_execucoes_ferramentas_select" ON ia_execucoes_ferramentas FOR SELECT USING (true);
CREATE POLICY "ia_execucoes_ferramentas_insert" ON ia_execucoes_ferramentas FOR INSERT WITH CHECK (true);
CREATE POLICY "ia_execucoes_ferramentas_update" ON ia_execucoes_ferramentas FOR UPDATE USING (true);
CREATE POLICY "ia_execucoes_ferramentas_delete" ON ia_execucoes_ferramentas FOR DELETE USING (true);

-- ==================== SEED: FERRAMENTAS PADRÃO ====================
INSERT INTO ia_ferramentas (codigo_unico, nome, descricao, categoria, precisa_aprovacao, risco_operacional, limite_execucoes_dia) VALUES
  ('COM_ENVIAR_EMAIL', 'Enviar E-mail', 'Envio de e-mail corporativo para clientes, prestadores e contatos', 'COMUNICACAO', true, 'medio', 50),
  ('COM_ENVIAR_WHATSAPP', 'Enviar WhatsApp', 'Envio de mensagens via WhatsApp corporativo', 'COMUNICACAO', true, 'alto', 100),
  ('COM_GERAR_CONTRATO', 'Gerar Contrato', 'Geração de contrato de prestação de serviços', 'DOCUMENTOS', true, 'alto', 20),
  ('COM_GERAR_PROPOSTA', 'Gerar Proposta Comercial', 'Criação de proposta comercial para cliente', 'COMERCIAL', true, 'alto', 30),
  ('COM_CONSULTAR_CNPJ', 'Consultar CNPJ', 'Consulta de dados cadastrais de CNPJ em API pública', 'INTEGRACOES', false, 'baixo', 100),
  ('COM_CONSULTAR_CPF', 'Consultar CPF', 'Consulta de dados cadastrais de CPF', 'INTEGRACOES', false, 'baixo', 100),
  ('COM_EMITIR_NFSE', 'Emitir NFS-e', 'Emissão de Nota Fiscal de Serviço eletrônica', 'DOCUMENTOS', true, 'critico', 50),
  ('COM_EMITIR_CTE', 'Emitir CT-e', 'Emissão de Conhecimento de Transporte eletrônico', 'DOCUMENTOS', true, 'critico', 50),
  ('COM_REALIZAR_COBRANCA', 'Realizar Cobrança', 'Envio de cobrança para cliente inadimplente', 'FINANCEIRO', true, 'critico', 30),
  ('COM_CONSULTAR_SALDO', 'Consultar Saldo', 'Consulta de saldo financeiro do cliente', 'FINANCEIRO', false, 'baixo', 200),
  ('COM_CADASTRAR_PRESTADOR', 'Cadastrar Prestador', 'Cadastro de novo prestador no sistema', 'OPERACIONAL', true, 'alto', 20),
  ('COM_AGENDAR_COLETA', 'Agendar Coleta', 'Agendamento de coleta para cliente', 'OPERACIONAL', true, 'medio', 50),
  ('COM_PUBLICAR_VAGA', 'Publicar Vaga', 'Publicação de vaga em plataformas de emprego', 'RECRUTAMENTO', true, 'medio', 10),
  ('COM_CONSULTAR_FRETE', 'Consultar Frete', 'Consulta de frete em plataformas de carga', 'OPERACIONAL', false, 'baixo', 100),
  ('COM_ENVIAR_BOLETO', 'Enviar Boleto', 'Envio de boleto bancário para cliente', 'FINANCEIRO', true, 'medio', 50)
ON CONFLICT (codigo_unico) DO NOTHING;
