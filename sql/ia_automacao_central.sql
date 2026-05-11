-- ============================================================
-- ARQUIVO: sql/ia_automacao_central.sql
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Módulo Central de Automação Inteligente (IA por setor)
-- ============================================================

-- 1. SETORES DA IA
CREATE TABLE IF NOT EXISTS ia_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE, -- 'comercial', 'operacional', 'financeiro', etc
  descricao text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- Inserir os setores básicos
INSERT INTO ia_setores (nome, descricao) VALUES 
('Comercial', 'Atendimento de leads e follow-up'),
('Operacional', 'Avisos de carga, confirmação de POD e escala'),
('Recrutamento', 'Triagem e banco de motoristas'),
('Financeiro', 'Cobrança simples e envio de boletos'),
('Monitoramento', 'Alertas de atraso e ocorrências'),
('Fiscal', 'Leitura e classificação de XMLs'),
('Cliente', 'Respostas a dúvidas de clientes no portal'),
('Prestador/Motorista', 'Atendimento ao motorista via App/WhatsApp')
ON CONFLICT (nome) DO NOTHING;

-- 2. REGRAS GERAIS POR SETOR
CREATE TABLE IF NOT EXISTS ia_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE CASCADE,
  instrucoes_principais text, -- Prompt master
  o_que_pode_fazer text,
  o_que_nao_pode_fazer text,
  quando_chamar_humano text,
  atualizado_por uuid,
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(setor_id)
);

-- 3. BASE DE CONHECIMENTO (FAQ e Documentos)
CREATE TABLE IF NOT EXISTS ia_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  url_arquivo text,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 4. MODELOS DE MENSAGENS E RESPOSTAS PADRÃO
CREATE TABLE IF NOT EXISTS ia_modelos_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE CASCADE,
  gatilho text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 5. LOGS DE DECISÕES DA IA
CREATE TABLE IF NOT EXISTS ia_decisoes_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE SET NULL,
  entidade_id text, -- ID da OS, do Lead, do Motorista
  contexto jsonb,
  decisao text NOT NULL,
  acao_executada text,
  sucesso boolean DEFAULT true,
  detalhes_erro text,
  criado_em timestamptz DEFAULT now()
);

-- 6. TAREFAS AUTOMÁTICAS (Scheduled / Cron Tasks da IA)
CREATE TABLE IF NOT EXISTS ia_tarefas_automaticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  frequencia text NOT NULL, -- 'hourly', 'daily', 'evento'
  prompt_execucao text NOT NULL,
  ultimo_run timestamptz,
  proximo_run timestamptz,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- 7. SOLICITAÇÕES DE APROVAÇÃO HUMANA (Fallback)
CREATE TABLE IF NOT EXISTS ia_aprovacoes_humanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES ia_setores(id) ON DELETE CASCADE,
  log_decisao_id uuid REFERENCES ia_decisoes_logs(id) ON DELETE SET NULL,
  motivo_escalonamento text NOT NULL,
  dados_contexto jsonb,
  status text DEFAULT 'pendente', -- pendente, aprovado, rejeitado, assumido
  responsavel_id uuid,
  resolvido_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_ia_regras_setor ON ia_regras(setor_id);
CREATE INDEX IF NOT EXISTS idx_ia_decisoes_logs_setor ON ia_decisoes_logs(setor_id);
CREATE INDEX IF NOT EXISTS idx_ia_aprovacoes_status ON ia_aprovacoes_humanas(status);
