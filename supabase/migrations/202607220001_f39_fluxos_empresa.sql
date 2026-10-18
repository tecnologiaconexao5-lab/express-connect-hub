-- ============================================================
-- F39 — ORQUESTRAÇÃO ENTERPRISE (FLUXOS CORPORATIVOS)
-- ============================================================

-- ==================== ENUMS ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_fluxo') THEN
    CREATE TYPE tipo_fluxo AS ENUM ('comercial','financeiro','operacional','rh','marketing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_fluxo_execucao') THEN
    CREATE TYPE status_fluxo_execucao AS ENUM ('pendente','em_andamento','concluido','falhou','bloqueado','cancelado');
  END IF;
END$$;

-- ==================== TABELA: FLUXOS DA EMPRESA ====================
CREATE TABLE IF NOT EXISTS ia_fluxos_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  descricao TEXT,
  tipo tipo_fluxo NOT NULL,
  codigo VARCHAR UNIQUE NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fluxos_empresa_tipo ON ia_fluxos_empresa(tipo);
CREATE INDEX IF NOT EXISTS idx_fluxos_empresa_ativo ON ia_fluxos_empresa(ativo);

-- ==================== TABELA: ETAPAS DOS FLUXOS ====================
CREATE TABLE IF NOT EXISTS ia_fluxos_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id UUID NOT NULL REFERENCES ia_fluxos_empresa(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome VARCHAR NOT NULL,
  descricao TEXT,
  origem_robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  destino_robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  setor_origem VARCHAR,
  setor_destino VARCHAR,
  acao_codigo VARCHAR,
  acao_payload JSONB DEFAULT '{}',
  condicoes JSONB DEFAULT '{}',
  timeout_segundos INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_fluxo ON ia_fluxos_etapas(fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_ordem ON ia_fluxos_etapas(fluxo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_origem ON ia_fluxos_etapas(origem_robo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_destino ON ia_fluxos_etapas(destino_robo_id);

-- ==================== TABELA: LOG DE EXECUÇÃO DOS FLUXOS ====================
CREATE TABLE IF NOT EXISTS ia_fluxos_execucao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id UUID REFERENCES ia_fluxos_empresa(id) ON DELETE SET NULL,
  fluxo_codigo VARCHAR NOT NULL,
  fluxo_nome VARCHAR NOT NULL,
  etapa_id UUID REFERENCES ia_fluxos_etapas(id) ON DELETE SET NULL,
  etapa_ordem INTEGER NOT NULL,
  etapa_nome VARCHAR NOT NULL,
  robo_origem_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  robo_destino_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  fluxo_execucao_id UUID NOT NULL,
  status status_fluxo_execucao NOT NULL DEFAULT 'pendente',
  pipeline JSONB DEFAULT '{}',
  decisao_f34a TEXT,
  risco_calculado DECIMAL DEFAULT 0,
  aprovado_f35 BOOLEAN,
  identidade_f36 TEXT,
  resultado_f37 JSONB DEFAULT '{}',
  impacto_f38 JSONB DEFAULT '{}',
  memoria_f33 JSONB DEFAULT '{}',
  decisao_f27 JSONB DEFAULT '{}',
  erro TEXT,
  inicio_execucao TIMESTAMPTZ DEFAULT now(),
  fim_execucao TIMESTAMPTZ,
  duracao_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_fluxo ON ia_fluxos_execucao_log(fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_execucao ON ia_fluxos_execucao_log(fluxo_execucao_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_status ON ia_fluxos_execucao_log(status);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_created ON ia_fluxos_execucao_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_robo ON ia_fluxos_execucao_log(robo_destino_id);

-- ==================== RLS ====================
ALTER TABLE ia_fluxos_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_fluxos_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_fluxos_execucao_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar fluxos empresa' AND tablename='ia_fluxos_empresa') THEN
    CREATE POLICY "Gerenciar fluxos empresa" ON ia_fluxos_empresa FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar fluxos etapas' AND tablename='ia_fluxos_etapas') THEN
    CREATE POLICY "Gerenciar fluxos etapas" ON ia_fluxos_etapas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar fluxos exec log' AND tablename='ia_fluxos_execucao_log') THEN
    CREATE POLICY "Gerenciar fluxos exec log" ON ia_fluxos_execucao_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ==================== TRIGGERS ====================
CREATE OR REPLACE FUNCTION f39_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fluxos_empresa_updated ON ia_fluxos_empresa;
CREATE TRIGGER trg_fluxos_empresa_updated BEFORE UPDATE ON ia_fluxos_empresa FOR EACH ROW EXECUTE FUNCTION f39_updated_at();

DROP TRIGGER IF EXISTS trg_fluxos_etapas_updated ON ia_fluxos_etapas;
CREATE TRIGGER trg_fluxos_etapas_updated BEFORE UPDATE ON ia_fluxos_etapas FOR EACH ROW EXECUTE FUNCTION f39_updated_at();

-- ==================== GRANTS ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_fluxos_empresa TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_fluxos_etapas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_fluxos_execucao_log TO anon, authenticated;

-- ==================== SEEDS ====================
INSERT INTO ia_fluxos_empresa (nome, descricao, tipo, codigo, versao, ativo, config) VALUES
('Fluxo Comercial Completo', 'Lead → SDR → Proposta → Aprovação → Simulação', 'comercial', 'FLUXO_COMERCIAL', 1, true, '{"categoria":"vendas","risco_padrao":"medio"}'),
('Fluxo Financeiro', 'Validação → Risco → Aprovação → Registro', 'financeiro', 'FLUXO_FINANCEIRO', 1, true, '{"categoria":"financeiro","risco_padrao":"alto"}'),
('Fluxo Operacional', 'Ordem de Serviço → Alocação → Execução → Finalização', 'operacional', 'FLUXO_OPERACIONAL', 1, true, '{"categoria":"operacao","risco_padrao":"baixo"}'),
('Fluxo de Marketing', 'Campanha → Criação → Revisão → Disparo', 'marketing', 'FLUXO_MARKETING', 1, true, '{"categoria":"marketing","risco_padrao":"medio"}'),
('Fluxo de RH Digital', 'Triagem → Entrevista → Avaliação → Contratação', 'rh', 'FLUXO_RH', 1, true, '{"categoria":"rh","risco_padrao":"baixo"}')
ON CONFLICT (codigo) DO NOTHING;

-- Etapas do Fluxo Comercial
DO $$
DECLARE
  v_fluxo_id UUID;
BEGIN
  SELECT id INTO v_fluxo_id FROM ia_fluxos_empresa WHERE codigo = 'FLUXO_COMERCIAL';
  IF v_fluxo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ia_fluxos_etapas WHERE fluxo_id = v_fluxo_id) THEN
    INSERT INTO ia_fluxos_etapas (fluxo_id, ordem, nome, descricao, setor_origem, setor_destino, acao_codigo, acao_payload, condicoes, timeout_segundos) VALUES
    (v_fluxo_id, 1, 'Capturar Lead', 'Captura lead do funil de entrada', 'marketing', 'comercial', 'LEADS_CAPTURAR', '{"acao":"capturar_lead"}', '{}', 120),
    (v_fluxo_id, 2, 'Qualificar Lead', 'Analisa perfil e pontua lead', 'comercial', 'comercial', 'LEADS_QUALIFICAR', '{"acao":"qualificar_lead"}', '{"score_minimo":30}', 180),
    (v_fluxo_id, 3, 'Criar Proposta', 'Gera proposta comercial com base no perfil', 'comercial', 'financeiro', 'CRM_CRIAR', '{"acao":"criar_oportunidade"}', '{}', 300),
    (v_fluxo_id, 4, 'Aprovar Proposta', 'Valida condições e aprova proposta', 'financeiro', 'comercial', 'GOV_APROVAR', '{"acao":"aprovar_proposta"}', '{"precisa_aprovacao":true}', 600),
    (v_fluxo_id, 5, 'Simular Contrato', 'Simula contrato com dados da proposta', 'comercial', 'operacional', 'CRM_CRIAR', '{"acao":"criar_cliente"}', '{}', 300);
  END IF;
END$$;

-- Etapas do Fluxo Financeiro
DO $$
DECLARE
  v_fluxo_id UUID;
BEGIN
  SELECT id INTO v_fluxo_id FROM ia_fluxos_empresa WHERE codigo = 'FLUXO_FINANCEIRO';
  IF v_fluxo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ia_fluxos_etapas WHERE fluxo_id = v_fluxo_id) THEN
    INSERT INTO ia_fluxos_etapas (fluxo_id, ordem, nome, descricao, setor_origem, setor_destino, acao_codigo, acao_payload, condicoes, timeout_segundos) VALUES
    (v_fluxo_id, 1, 'Validar Documentos', 'Valida documentação financeira do cliente', 'financeiro', 'financeiro', 'API_EXTERNA_CONSULTAR', '{"acao":"consultar","url":"/validar/documentos"}', '{}', 180),
    (v_fluxo_id, 2, 'Analisar Risco', 'Calcula score de risco financeiro', 'financeiro', 'financeiro', 'GOV_AVALIAR', '{"acao":"analisar_risco"}', '{"score_minimo":50}', 300),
    (v_fluxo_id, 3, 'Aprovar Operação', 'Aprova operação financeira', 'financeiro', 'financeiro', 'GOV_APROVAR', '{"acao":"aprovar_operacao"}', '{"precisa_aprovacao":true,"valor_minimo":1000}', 600),
    (v_fluxo_id, 4, 'Registrar Transação', 'Registra transação no sistema financeiro', 'financeiro', 'financeiro', 'API_EXTERNA_ENVIAR', '{"acao":"enviar_dados","url":"/financeiro/transacoes"}', '{}', 120);
  END IF;
END$$;

-- Etapas do Fluxo Operacional
DO $$
DECLARE
  v_fluxo_id UUID;
BEGIN
  SELECT id INTO v_fluxo_id FROM ia_fluxos_empresa WHERE codigo = 'FLUXO_OPERACIONAL';
  IF v_fluxo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ia_fluxos_etapas WHERE fluxo_id = v_fluxo_id) THEN
    INSERT INTO ia_fluxos_etapas (fluxo_id, ordem, nome, descricao, setor_origem, setor_destino, acao_codigo, acao_payload, condicoes, timeout_segundos) VALUES
    (v_fluxo_id, 1, 'Criar Ordem de Serviço', 'Registra nova ordem de serviço', 'comercial', 'operacional', 'CRM_CRIAR', '{"acao":"criar_cliente"}', '{}', 120),
    (v_fluxo_id, 2, 'Alocar Recursos', 'Aloca recursos para execução da OS', 'operacional', 'operacional', 'WEBHOOK_DISPARAR', '{"acao":"disparar","evento":"alocar_recursos"}', '{}', 300),
    (v_fluxo_id, 3, 'Executar Serviço', 'Executa o serviço programado', 'operacional', 'operacional', 'API_EXTERNA_ENVIAR', '{"acao":"enviar_dados","url":"/operacional/executar"}', '{}', 600),
    (v_fluxo_id, 4, 'Finalizar e Registrar', 'Finaliza OS e registra resultado', 'operacional', 'comercial', 'WEBHOOK_NOTIFICAR', '{"acao":"notificar","evento":"os_concluida"}', '{}', 120);
  END IF;
END$$;

-- Etapas do Fluxo de Marketing
DO $$
DECLARE
  v_fluxo_id UUID;
BEGIN
  SELECT id INTO v_fluxo_id FROM ia_fluxos_empresa WHERE codigo = 'FLUXO_MARKETING';
  IF v_fluxo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ia_fluxos_etapas WHERE fluxo_id = v_fluxo_id) THEN
    INSERT INTO ia_fluxos_etapas (fluxo_id, ordem, nome, descricao, setor_origem, setor_destino, acao_codigo, acao_payload, condicoes, timeout_segundos) VALUES
    (v_fluxo_id, 1, 'Planejar Campanha', 'Define objetivos e orçamento da campanha', 'marketing', 'marketing', 'GOOGLE_CRIAR', '{"acao":"criar_campanha"}', '{}', 300),
    (v_fluxo_id, 2, 'Criar Conteúdo', 'Gera materiais da campanha', 'marketing', 'marketing', 'META_CRIAR', '{"acao":"criar_anuncio"}', '{}', 600),
    (v_fluxo_id, 3, 'Revisar e Aprovar', 'Revisão final e aprovação', 'marketing', 'financeiro', 'GOV_APROVAR', '{"acao":"aprovar_campanha"}', '{"precisa_aprovacao":true,"valor_minimo":500}', 300),
    (v_fluxo_id, 4, 'Disparar Campanha', 'Ativa campanha nos canais', 'marketing', 'marketing', 'META_CRIAR', '{"acao":"agendar_post"}', '{}', 120);
  END IF;
END$$;

-- Etapas do Fluxo de RH
DO $$
DECLARE
  v_fluxo_id UUID;
BEGIN
  SELECT id INTO v_fluxo_id FROM ia_fluxos_empresa WHERE codigo = 'FLUXO_RH';
  IF v_fluxo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ia_fluxos_etapas WHERE fluxo_id = v_fluxo_id) THEN
    INSERT INTO ia_fluxos_etapas (fluxo_id, ordem, nome, descricao, setor_origem, setor_destino, acao_codigo, acao_payload, condicoes, timeout_segundos) VALUES
    (v_fluxo_id, 1, 'Triar Candidatos', 'Analisa currículos recebidos', 'rh', 'rh', 'API_EXTERNA_CONSULTAR', '{"acao":"consultar","url":"/rh/triar"}', '{}', 180),
    (v_fluxo_id, 2, 'Agendar Entrevista', 'Agenda entrevista com candidato', 'rh', 'rh', 'EMAIL_ENVIAR', '{"acao":"enviar_email"}', '{}', 120),
    (v_fluxo_id, 3, 'Avaliar Candidato', 'Registra avaliação do candidato', 'rh', 'rh', 'CRM_CRIAR', '{"acao":"criar_cliente"}', '{"score_minimo":60}', 300),
    (v_fluxo_id, 4, 'Gerar Contrato', 'Gera proposta de contratação', 'rh', 'financeiro', 'CRM_CRIAR', '{"acao":"criar_oportunidade"}', '{}', 300);
  END IF;
END$$;
