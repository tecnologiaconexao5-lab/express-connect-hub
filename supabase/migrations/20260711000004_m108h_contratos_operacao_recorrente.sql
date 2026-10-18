-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-H — CONTRATOS ENTERPRISE E OPERAÇÕES RECORRENTES
--
-- ETAPAS 2-5:
--   contratos_operacao (cliente, vigência, tabela, reversa, financeiro)
--   contratos_operacao_rotas (múltiplas rotas por contrato)
--   contratos_operacao_execucao (OS geradas, controle de duplicidade)
--   Motor de geração automática (TS service)
--   Calendário: diário, semanal, quinzenal, mensal
--
-- REAPROVEITA contratos_gerados (prestador TAC/ETC) — NÃO ALTERADO
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Tabela: contratos_operacao
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contratos_operacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID DEFAULT public.current_tenant_id_safe(),
  numero TEXT UNIQUE NOT NULL,
  
  -- Cliente
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  
  -- Vigência
  data_inicio DATE NOT NULL,
  data_fim DATE,
  renovacao_automatica BOOLEAN DEFAULT false,
  
  -- Configuração de frequência
  frequencia TEXT NOT NULL DEFAULT 'diaria'
    CHECK (frequencia IN ('diaria', 'semanal', 'quinzenal', 'mensal', 'data_especifica')),
  dias_semana INTEGER[] DEFAULT '{}',  -- 0=Dom, 1=Seg, ..., 6=Sáb
  dia_mes INTEGER,  -- Para frequência mensal (1-31)
  datas_especificas DATE[],  -- Para datas específicas
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '18:00',
  
  -- SLA
  sla_entrega_horas INTEGER DEFAULT 24,
  tolerancia_atraso_minutos INTEGER DEFAULT 30,
  
  -- Tabela de valores (M108-G)
  tabela_valores_id UUID REFERENCES public.tabelas_valores(id) ON DELETE SET NULL,
  
  -- Reversa (M108-F)
  tipo_reversa TEXT DEFAULT 'sem_reversa'
    CHECK (tipo_reversa IN ('sem_reversa', 'coleta_reversa', 'devolucao', 'troca', 'retorno_cd')),
  reversa_config JSONB DEFAULT '{}'::jsonb,
  
  -- Financeiro
  dias_para_vencimento INTEGER DEFAULT 30,
  aliquota_iss NUMERIC(5,2) DEFAULT 4.5,
  
  -- Prestador fixo ou Rede
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  usar_rede BOOLEAN DEFAULT false,
  
  -- Documentos obrigatórios
  documentos_obrigatorios TEXT[] DEFAULT '{}',
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  suspenso_ate DATE,
  motivo_suspensao TEXT,
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- SEÇÃO 2 — Tabela: contratos_operacao_rotas
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contratos_operacao_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos_operacao(id) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  
  -- Origem/Destino
  origem_cep TEXT,
  origem_cidade TEXT NOT NULL,
  origem_uf TEXT NOT NULL,
  origem_logradouro TEXT,
  origem_numero TEXT,
  origem_bairro TEXT,
  origem_complemento TEXT,
  origem_latitude NUMERIC,
  origem_longitude NUMERIC,
  
  destino_cep TEXT,
  destino_cidade TEXT NOT NULL,
  destino_uf TEXT NOT NULL,
  destino_logradouro TEXT,
  destino_numero TEXT,
  destino_bairro TEXT,
  destino_complemento TEXT,
  destino_latitude NUMERIC,
  destino_longitude NUMERIC,
  
  -- Veículo
  tipo_veiculo TEXT NOT NULL,
  veiculo_placa TEXT,
  veiculo_carroceria TEXT,
  veiculo_termica TEXT DEFAULT 'seco',
  
  -- Operação
  tipo_operacao TEXT NOT NULL DEFAULT 'Entrega',
  distancia_km NUMERIC(10,2) DEFAULT 0,
  peso_medio_kg NUMERIC(10,2) DEFAULT 0,
  volumes_medio INTEGER DEFAULT 0,
  
  -- Tabela específica (opcional, sobrescreve a do contrato)
  tabela_valores_id UUID REFERENCES public.tabelas_valores(id) ON DELETE SET NULL,
  
  -- Prestador específico (opcional)
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,
  
  -- Horários específicos (opcional, sobrescreve contrato)
  horario_inicio TIME,
  horario_fim TIME,
  
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SEÇÃO 3 — Tabela: contratos_operacao_execucao (OS geradas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contratos_operacao_execucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos_operacao(id) ON DELETE CASCADE,
  rota_id UUID REFERENCES public.contratos_operacao_rotas(id) ON DELETE SET NULL,
  
  -- OS gerada
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  alocacao_id UUID REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL,
  
  -- Data da operação gerada
  data_geracao DATE NOT NULL,
  data_operacao DATE NOT NULL,
  
  -- Status da geração
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'gerada', 'cancelada', 'falha')),
  erro TEXT,
  
  -- Controle de duplicidade (só gera uma vez por dia por rota)
  UNIQUE (rota_id, data_operacao),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- SEÇÃO 4 — Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_contratos_operacao_cliente ON public.contratos_operacao(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_operacao_ativo ON public.contratos_operacao(ativo);
CREATE INDEX IF NOT EXISTS idx_contratos_operacao_frequencia ON public.contratos_operacao(frequencia);
CREATE INDEX IF NOT EXISTS idx_contratos_rotas_contrato ON public.contratos_operacao_rotas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_execucao_contrato ON public.contratos_operacao_execucao(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_execucao_data ON public.contratos_operacao_execucao(data_operacao);
CREATE INDEX IF NOT EXISTS idx_contratos_execucao_status ON public.contratos_operacao_execucao(status);

-- =============================================================================
-- SEÇÃO 5 — RLS
-- =============================================================================
ALTER TABLE public.contratos_operacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_operacao_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_operacao_execucao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_operacao_select" ON public.contratos_operacao FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL);
CREATE POLICY "contratos_operacao_insert" ON public.contratos_operacao FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "contratos_operacao_update" ON public.contratos_operacao FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL);

CREATE POLICY "contratos_rotas_select" ON public.contratos_operacao_rotas FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "contratos_rotas_insert" ON public.contratos_operacao_rotas FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "contratos_rotas_update" ON public.contratos_operacao_rotas FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "contratos_execucao_select" ON public.contratos_operacao_execucao FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "contratos_execucao_insert" ON public.contratos_operacao_execucao FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- SEÇÃO 6 — Função de número de contrato
-- =============================================================================
CREATE OR REPLACE FUNCTION public.gerar_numero_contrato_operacao()
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ano TEXT;
  proximo INTEGER;
BEGIN
  ano := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(NULLIF(SUBSTRING(numero FROM 10 FOR 6), '')::INTEGER), 0) + 1
    INTO proximo
    FROM public.contratos_operacao
    WHERE numero LIKE 'CTR-OP-' || ano || '-%';
  RETURN 'CTR-OP-' || ano || '-' || LPAD(proximo::TEXT, 6, '0');
END;
$$;
