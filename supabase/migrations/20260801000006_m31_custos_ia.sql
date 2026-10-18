-- Missão 31 — Supervisor Inteligente de IA + Hardening de Segredos
-- Tabela de custos IA por tenant/provedor

CREATE TABLE IF NOT EXISTS ia_custos_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  usuario_id UUID,
  provedor TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tipo_tarefa TEXT NOT NULL,
  complexidade TEXT NOT NULL CHECK (complexidade IN ('1_economico', '2_intermediario', '3_complexo')),
  modo_tenant TEXT NOT NULL CHECK (modo_tenant IN ('economico', 'balanceado', 'premium')),
  tokens_entrada INTEGER DEFAULT 0,
  tokens_saida INTEGER DEFAULT 0,
  custo_estimado DECIMAL(12, 8) DEFAULT 0,
  tempo_resposta_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso', 'falha', 'fallback', 'cache')),
  erro_resumido TEXT,
  tempo_execucao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas de dashboard
CREATE INDEX IF NOT EXISTS idx_ia_custos_tenant ON ia_custos_ia(tenant_id, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_provedor ON ia_custos_ia(provedor, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_tipo ON ia_custos_ia(tipo_tarefa, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_data ON ia_custos_ia(tempo_execucao DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ia_custos_ia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ia_custos_ia_updated_at ON ia_custos_ia;
CREATE TRIGGER trg_ia_custos_ia_updated_at
  BEFORE UPDATE ON ia_custos_ia
  FOR EACH ROW
  EXECUTE FUNCTION update_ia_custos_ia_updated_at();

-- RLS
ALTER TABLE ia_custos_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem custos do próprio tenant"
  ON ia_custos_ia FOR SELECT
  USING (tenant_id = current_tenant_id_safe());

CREATE POLICY "Super admin vê todos os custos"
  ON ia_custos_ia FOR SELECT
  USING (public.user_can_manage_tenants(auth.uid()));

-- Tabela de configuração de IA por tenant
CREATE TABLE IF NOT EXISTS ia_config_tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  modo TEXT NOT NULL DEFAULT 'balanceado' CHECK (modo IN ('economico', 'balanceado', 'premium')),
  provider_principal TEXT DEFAULT 'groq',
  provider_secundario TEXT DEFAULT 'gemini',
  provider_fallback TEXT DEFAULT 'openrouter',
  limite_custo_diario_usd DECIMAL(10, 4) DEFAULT 5.00,
  cache_ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_config_tenant ON ia_config_tenant(tenant_id);

ALTER TABLE ia_config_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem config do próprio tenant"
  ON ia_config_tenant FOR SELECT
  USING (tenant_id = current_tenant_id_safe());

CREATE POLICY "Super admin gerencia config"
  ON ia_config_tenant FOR ALL
  USING (public.user_can_manage_tenants(auth.uid()));
