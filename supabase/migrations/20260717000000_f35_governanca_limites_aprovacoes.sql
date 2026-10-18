-- ============================================================
-- F35 — GOVERNANÇA, LIMITES E APROVAÇÕES OPERACIONAIS
-- ============================================================

-- 1. MATRIZ DE AUTORIDADE (FASE 2)
CREATE TABLE IF NOT EXISTS ia_autoridade_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  acao_tipo VARCHAR NOT NULL,
  permitido BOOLEAN DEFAULT true,
  condicoes JSONB DEFAULT '{}',
  valor_maximo NUMERIC(15,2),
  risco_maximo VARCHAR DEFAULT 'critico',
  precisa_aprovacao BOOLEAN DEFAULT false,
  supervisor_robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  supervisor_setor VARCHAR,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(robo_id, acao_tipo)
);

-- 2. CONFIGURAÇÃO DE ESCALONAMENTO (FASE 5)
CREATE TABLE IF NOT EXISTS ia_escalonamento_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_acao VARCHAR NOT NULL,
  nivel_risco_min VARCHAR,
  valor_min NUMERIC(15,2),
  nivel_ordem INTEGER NOT NULL DEFAULT 1,
  aprovador_tipo VARCHAR NOT NULL DEFAULT 'supervisor',
  aprovador_robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  aprovador_setor VARCHAR,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tipo_acao, nivel_ordem)
);

-- 3. FILA DE APROVAÇÕES CORPORATIVAS (FASE 4)
CREATE TABLE IF NOT EXISTS ia_aprovacoes_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  execucao_ferramenta_id UUID REFERENCES ia_execucoes_ferramentas(id) ON DELETE SET NULL,
  acao_tipo VARCHAR NOT NULL,
  acao_descricao TEXT,
  contexto JSONB DEFAULT '{}',
  justificativa TEXT,
  risco VARCHAR DEFAULT 'medio',
  valor_financeiro NUMERIC(15,2) DEFAULT 0,
  status VARCHAR DEFAULT 'pendente',
  nivel_atual INTEGER DEFAULT 1,
  nivel_maximo INTEGER DEFAULT 3,
  aprovador_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  aprovador_tipo VARCHAR,
  aprovado_em TIMESTAMPTZ,
  rejeitado_em TIMESTAMPTZ,
  observacao TEXT,
  expiracao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LOG DE GOVERNANÇA (FASE 7)
CREATE TABLE IF NOT EXISTS ia_governanca_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  acao_tipo VARCHAR,
  decisao VARCHAR NOT NULL,
  contexto JSONB DEFAULT '{}',
  regra_aplicada JSONB DEFAULT '{}',
  resultado VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_autoridade_robo ON ia_autoridade_acoes(robo_id);
CREATE INDEX IF NOT EXISTS idx_autoridade_acao ON ia_autoridade_acoes(acao_tipo);
CREATE INDEX IF NOT EXISTS idx_escalonamento_tipo ON ia_escalonamento_config(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_status ON ia_aprovacoes_fila(status);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_robo ON ia_aprovacoes_fila(robo_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_aprovador ON ia_aprovacoes_fila(aprovador_id);
CREATE INDEX IF NOT EXISTS idx_governanca_log_robo ON ia_governanca_log(robo_id);
CREATE INDEX IF NOT EXISTS idx_governanca_log_acao ON ia_governanca_log(acao_tipo);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ia_autoridade_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_escalonamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_aprovacoes_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_governanca_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver autoridade" ON ia_autoridade_acoes FOR SELECT USING (true);
CREATE POLICY "Gerenciar autoridade" ON ia_autoridade_acoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Todos podem ver escalonamento" ON ia_escalonamento_config FOR SELECT USING (true);
CREATE POLICY "Gerenciar escalonamento" ON ia_escalonamento_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Todos podem ver aprovacoes" ON ia_aprovacoes_fila FOR SELECT USING (true);
CREATE POLICY "Robos podem criar aprovacoes" ON ia_aprovacoes_fila FOR INSERT WITH CHECK (true);
CREATE POLICY "Aprovador pode atualizar" ON ia_aprovacoes_fila FOR UPDATE USING (true);
CREATE POLICY "Todos podem ver governanca log" ON ia_governanca_log FOR SELECT USING (true);
CREATE POLICY "Sistema pode inserir governanca log" ON ia_governanca_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION f35_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_autoridade_updated_at BEFORE UPDATE ON ia_autoridade_acoes
  FOR EACH ROW EXECUTE FUNCTION f35_updated_at();
CREATE TRIGGER trg_aprovacoes_fila_updated_at BEFORE UPDATE ON ia_aprovacoes_fila
  FOR EACH ROW EXECUTE FUNCTION f35_updated_at();

-- ============================================================
-- SEEDS — AUTORIDADE PADRÃO POR SETOR
-- ============================================================
-- Comercial IA: pode gerar proposta, qualificar lead; NÃO pode fechar contrato
-- Financeiro IA: pode conferir cobrança; NÃO pode pagar
-- RH IA: pode selecionar candidato; NÃO pode contratar
-- Operacional IA: pode agendar coleta; NÃO pode alterar valor
-- Fiscal IA: pode emitir NF; precisa aprovação para CTE > 5000

-- (Seeds serão inseridos via aplicação conforme robôs existentes)
