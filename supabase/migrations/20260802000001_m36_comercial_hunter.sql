-- M36 — Funcionário Comercial IA Enterprise (Hunter SDR Digital)
-- Tabelas de configuração, execução, resultados e aprendizado do Hunter Comercial

-- ============================================================
-- ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE hunter_status_resultado AS ENUM (
    'encontrado', 'duplicado', 'descartado', 'lead_criado', 'abordado',
    'respondeu', 'ignorou', 'recusou', 'virou_cliente', 'orcamento', 'fechou'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE hunter_modo AS ENUM ('manual', 'assistido', 'automatico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. Configuração do Hunter por Robô
-- ============================================================
CREATE TABLE IF NOT EXISTS comercial_hunter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  modo hunter_modo DEFAULT 'assistido',

  -- Horários / Dias
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '18:00',
  dias_semana INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 0=domingo, 1=segunda...

  -- Segmentos Prioritários
  segmentos TEXT[] DEFAULT ARRAY[
    'Farmacias', 'Laboratorios', 'Distribuidoras', 'Industrias',
    'E-commerce', 'Autopecas', 'Hospitais', 'Clinicas',
    'Pet Shops', 'Graficas', 'Confeccoes', 'Cosmeticos',
    'Alimentos', 'Bebidas', 'Eletronicos', 'Materiais Medicos',
    'Materiais Eletricos'
  ],

  -- Regiões / Estados
  estados TEXT[] DEFAULT ARRAY['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'DF', 'GO'],
  regioes TEXT[] DEFAULT ARRAY['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste'],

  -- Limites
  score_minimo INTEGER DEFAULT 40,
  max_leads_por_dia INTEGER DEFAULT 10,
  max_prospeccoes_por_ciclo INTEGER DEFAULT 20,

  -- Fontes de prospecção (ativa via IA)
  fontes TEXT[] DEFAULT ARRAY[
    'google', 'google_maps', 'linkedin', 'instagram', 'facebook',
    'catalogos_industriais', 'associacoes', 'federacoes',
    'sites_empresariais', 'portais_b2b'
  ],

  -- Follow-up
  followup_dias INTEGER[] DEFAULT ARRAY[2, 5, 10, 20],
  max_followups INTEGER DEFAULT 4,
  arquivar_apos_dias INTEGER DEFAULT 30,

  -- Abordagem
  gerar_whatsapp BOOLEAN DEFAULT true,
  gerar_email BOOLEAN DEFAULT true,
  gerar_linkedin BOOLEAN DEFAULT false,
  gerar_instagram BOOLEAN DEFAULT false,
  gerar_script_ligacao BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(robo_id)
);

-- ============================================================
-- 2. Execuções do Hunter
-- ============================================================
CREATE TABLE IF NOT EXISTS comercial_hunter_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  config_id UUID REFERENCES comercial_hunter_config(id) ON DELETE SET NULL,

  status TEXT DEFAULT 'executando', -- executando, concluido, erro
  inicio TIMESTAMPTZ DEFAULT now(),
  fim TIMESTAMPTZ,
  resumo TEXT,

  -- Métricas da execução
  empresas_encontradas INTEGER DEFAULT 0,
  leads_criados INTEGER DEFAULT 0,
  leads_descartados INTEGER DEFAULT 0,
  duplicatas_evitadas INTEGER DEFAULT 0,

  -- Custos
  tokens_entrada INTEGER DEFAULT 0,
  tokens_saida INTEGER DEFAULT 0,
  custo_estimado NUMERIC(10,4) DEFAULT 0,

  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Resultados da Prospecção (empresas encontradas)
-- ============================================================
CREATE TABLE IF NOT EXISTS comercial_hunter_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id UUID REFERENCES comercial_hunter_execucoes(id) ON DELETE CASCADE,
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,

  -- Identificação
  empresa TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  segmento TEXT,
  site TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  responsavel_nome TEXT,
  responsavel_cargo TEXT,
  linkedin TEXT,
  instagram TEXT,
  facebook TEXT,
  endereco TEXT,
  cnpj TEXT,

  -- Classificação
  necessidade_provavel TEXT,
  volume_estimado TEXT,
  urgencia hunter_status_resultado DEFAULT 'encontrado',
  temperatura TEXT DEFAULT 'frio',
  probabilidade INTEGER DEFAULT 0,
  score_ia INTEGER DEFAULT 0,

  -- Origem da prospecção
  fonte TEXT,
  fonte_url TEXT,
  resumo_ia TEXT,

  -- Status
  status hunter_status_resultado DEFAULT 'encontrado',
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  motivo_descarte TEXT,

  -- Metadados
  dados_enriquecidos JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Aprendizado do Hunter
-- ============================================================
CREATE TABLE IF NOT EXISTS comercial_hunter_aprendizado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  resultado_id UUID REFERENCES comercial_hunter_resultados(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,

  -- O que aconteceu
  tipo TEXT NOT NULL, -- respondeu, ignorou, recusou, virou_cliente, orcamento, fechou, pediu_retorno
  descricao TEXT,
  dados JSONB DEFAULT '{}',

  -- Métricas de aprendizado
  score_antes INTEGER,
  score_depois INTEGER,
  feedback TEXT,
  acao_corretiva TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hunter_resultados_robo ON comercial_hunter_resultados(robo_id);
CREATE INDEX IF NOT EXISTS idx_hunter_resultados_status ON comercial_hunter_resultados(status);
CREATE INDEX IF NOT EXISTS idx_hunter_resultados_empresa ON comercial_hunter_resultados(empresa);
CREATE INDEX IF NOT EXISTS idx_hunter_resultados_segmento ON comercial_hunter_resultados(segmento);
CREATE INDEX IF NOT EXISTS idx_hunter_execucoes_robo ON comercial_hunter_execucoes(robo_id);
CREATE INDEX IF NOT EXISTS idx_hunter_aprendizado_robo ON comercial_hunter_aprendizado(robo_id);
CREATE INDEX IF NOT EXISTS idx_hunter_aprendizado_tipo ON comercial_hunter_aprendizado(tipo);

-- ============================================================
-- RLS (mesmo padrão das outras tabelas)
-- ============================================================
ALTER TABLE comercial_hunter_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_hunter_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_hunter_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comercial_hunter_aprendizado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler hunter_config" ON comercial_hunter_config
  FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir hunter_config" ON comercial_hunter_config
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar hunter_config" ON comercial_hunter_config
  FOR UPDATE USING (true);

CREATE POLICY "Todos podem ler hunter_execucoes" ON comercial_hunter_execucoes
  FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir hunter_execucoes" ON comercial_hunter_execucoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos podem ler hunter_resultados" ON comercial_hunter_resultados
  FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir hunter_resultados" ON comercial_hunter_resultados
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar hunter_resultados" ON comercial_hunter_resultados
  FOR UPDATE USING (true);

CREATE POLICY "Todos podem ler hunter_aprendizado" ON comercial_hunter_aprendizado
  FOR SELECT USING (true);
CREATE POLICY "Todos podem inserir hunter_aprendizado" ON comercial_hunter_aprendizado
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public_atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunter_config_updated_at ON comercial_hunter_config;
CREATE TRIGGER trg_hunter_config_updated_at
  BEFORE UPDATE ON comercial_hunter_config
  FOR EACH ROW EXECUTE FUNCTION public_atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_hunter_resultados_updated_at ON comercial_hunter_resultados;
CREATE TRIGGER trg_hunter_resultados_updated_at
  BEFORE UPDATE ON comercial_hunter_resultados
  FOR EACH ROW EXECUTE FUNCTION public_atualizar_updated_at();

-- ============================================================
-- Seed: Config padrão para o robô Comercial IA
-- ============================================================
INSERT INTO comercial_hunter_config (robo_id, modo, ativo)
SELECT id, 'assistido', true
FROM automacoes_robos
WHERE nome = 'Comercial IA'
AND NOT EXISTS (
  SELECT 1 FROM comercial_hunter_config WHERE robo_id = automacoes_robos.id
);
