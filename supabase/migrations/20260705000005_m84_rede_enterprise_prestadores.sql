-- Migration M84: Rede Enterprise de Prestadores
-- Conexão Express TMS — 2026-07-05
--
-- Propósito: Permitir que OS seja enviada para uma Rede de Prestadores
-- onde prestadores compatíveis podem visualizar e aceitar oportunidades.
--
-- REGRA: Não duplica máquina de estados da OS. Não cria fluxo paralelo.
-- A Rede é apenas uma forma inteligente de alocação dentro da OS existente.
--
-- Fluxo:
--   OS criada → Operador envia para Rede → Oportunidade publicada
--   → Prestadores compatíveis visualizam (App Motorista)
--   → Primeiro que aceitar assume → Escala criada/atualizada
--   → Triggers financeiros existentes (M66/M80) propagam

-- ============================================================
-- 1. ENUM rede_oportunidade_status
-- ============================================================
DO $$ BEGIN
  CREATE TYPE rede_oportunidade_status AS ENUM (
    'publicada',
    'visualizada',
    'interessada',
    'aceita',
    'expirada',
    'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tabela: rede_oportunidades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rede_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com OS (a OS é a fonte operacional principal)
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  UNIQUE(os_id), -- Apenas uma oportunidade ativa por OS

  -- Estado da oportunidade (não duplica estado da OS)
  status rede_oportunidade_status NOT NULL DEFAULT 'publicada',

  -- Prestador que aceitou (NULL até aceite)
  prestador_aceite_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL,

  -- Valor do prestador vindo do Engine de Precificação
  valor_prestador NUMERIC(12,2) DEFAULT 0,

  -- Veículo exigido para a operação
  veiculo_necessario JSONB DEFAULT '{}'::jsonb,
  -- Ex: {"tipo": "VUC", "carroceria": "ba\xfa", "capacidade_kg": 3000, "capacidade_m3": 15, "termica": "seco"}

  -- Região da operação
  regiao TEXT,

  -- Requisitos adicionais (array de strings)
  requisitos JSONB DEFAULT '[]'::jsonb,
  -- Ex: ["documentacao_valida", "score_minimo_50", "veiculo_proprio"]

  -- Prazo de expiração
  prazo_expiracao TIMESTAMPTZ,

  -- Timestamps
  aceite_em TIMESTAMPTZ,
  expirada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Tabela: rede_visualizacoes
-- Rastreia quais prestadores visualizaram/demonstraram interesse
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rede_visualizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID NOT NULL REFERENCES public.rede_oportunidades(id) ON DELETE CASCADE,
  prestador_id UUID NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'visualizada' CHECK (status IN ('visualizada', 'interessada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oportunidade_id, prestador_id)
);

-- ============================================================
-- 4. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_os_id ON public.rede_oportunidades(os_id);
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_status ON public.rede_oportunidades(status);
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_prazo ON public.rede_oportunidades(prazo_expiracao)
  WHERE status = 'publicada';
CREATE INDEX IF NOT EXISTS idx_rede_visualizacoes_oportunidade ON public.rede_visualizacoes(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_rede_visualizacoes_prestador ON public.rede_visualizacoes(prestador_id);

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.rede_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_visualizacoes ENABLE ROW LEVEL SECURITY;

-- TMS: full access para usuários autenticados
CREATE POLICY "rede_oportunidades_all_authenticated" ON public.rede_oportunidades
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: SELECT apenas (consistente com outras tabelas do projeto)
CREATE POLICY "rede_oportunidades_select_anon" ON public.rede_oportunidades
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "rede_visualizacoes_all_authenticated" ON public.rede_visualizacoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "rede_visualizacoes_select_anon" ON public.rede_visualizacoes
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 6. Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION f_trg_rede_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rede_oportunidades_updated_at ON public.rede_oportunidades;
CREATE TRIGGER trg_rede_oportunidades_updated_at
  BEFORE UPDATE ON public.rede_oportunidades
  FOR EACH ROW EXECUTE FUNCTION f_trg_rede_updated_at();

-- ============================================================
-- 7. Trigger para expirar oportunidades automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION f_trg_expiracao_oportunidade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prazo_expiracao IS NOT NULL AND NEW.prazo_expiracao < NOW() AND NEW.status = 'publicada' THEN
    NEW.status = 'expirada';
    NEW.expirada_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rede_oportunidades_expiracao ON public.rede_oportunidades;
CREATE TRIGGER trg_rede_oportunidades_expiracao
  BEFORE INSERT OR UPDATE ON public.rede_oportunidades
  FOR EACH ROW EXECUTE FUNCTION f_trg_expiracao_oportunidade();

-- ============================================================
-- 8. Função para buscar prestadores compatíveis com uma oportunidade
-- ============================================================
CREATE OR REPLACE FUNCTION f_buscar_prestadores_compativeis(p_oportunidade_id UUID)
RETURNS TABLE (
  prestador_id UUID,
  nome_completo TEXT,
  telefone TEXT,
  whatsapp TEXT,
  score_interno NUMERIC,
  tipo_veiculo TEXT,
  placa TEXT,
  capacidade_kg NUMERIC,
  regiao_principal TEXT,
  aceita_refrigerada BOOLEAN,
  status TEXT,
  score_match NUMERIC
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_os_id UUID;
  v_veiculo JSONB;
  v_regiao TEXT;
  v_requisitos JSONB;
  v_regiao_like TEXT;
  v_regiao_cidade TEXT;
  v_regiao_estado TEXT;
BEGIN
  SELECT r.os_id, r.veiculo_necessario, r.regiao, r.requisitos
  INTO v_os_id, v_veiculo, v_regiao, v_requisitos
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id AND r.status = 'publicada';

  IF NOT FOUND THEN RETURN; END IF;

  -- Preparar variações de região para matching flexível
  v_regiao_like := '%' || COALESCE(v_regiao, '') || '%';
  v_regiao_cidade := split_part(COALESCE(v_regiao, ''), '/', 1);
  v_regiao_estado := split_part(COALESCE(v_regiao, ''), '/', 2);

  RETURN QUERY
  WITH prestadores_filtrados AS (
    SELECT
      p.id,
      p.nome_completo,
      p.telefone,
      p.whatsapp,
      COALESCE(p.score_interno, 0) as score_interno,
      v.tipo_veiculo,
      v.placa,
      v.capacidade_kg,
      p.regiao_principal,
      p.aceita_refrigerada,
      p.status
    FROM prestadores p
    LEFT JOIN LATERAL (
      SELECT v2.tipo_veiculo, v2.placa, v2.capacidade_kg
      FROM veiculos v2
      WHERE v2.prestador_vinculado::text = p.id::text AND v2.status = 'Ativo'
      LIMIT 1
    ) v ON true
    WHERE
      p.status = 'ativo'
      AND (
        v_regiao IS NULL OR v_regiao = '' OR
        p.regiao_principal ILIKE v_regiao_like OR
        EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE v_regiao_like) OR
        (v_regiao_cidade <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_cidade || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_cidade || '%'))) OR
        (v_regiao_estado <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_estado || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_estado || '%')))
      )
  )
  SELECT
    pf.id, pf.nome_completo, pf.telefone, pf.whatsapp, pf.score_interno,
    pf.tipo_veiculo, pf.placa, pf.capacidade_kg, pf.regiao_principal,
    pf.aceita_refrigerada, pf.status,
    (
      CASE WHEN pf.tipo_veiculo IS NOT NULL AND (v_veiculo->>'tipo' IS NULL OR pf.tipo_veiculo ILIKE '%' || COALESCE(v_veiculo->>'tipo', '') || '%') THEN 35 ELSE 0 END +
      CASE WHEN pf.regiao_principal IS NOT NULL AND (v_regiao IS NULL OR v_regiao = '' OR pf.regiao_principal ILIKE v_regiao_like) THEN 25
           WHEN v_regiao IS NOT NULL AND v_regiao <> '' THEN 15 ELSE 0 END +
      CASE WHEN (v_veiculo->>'termica' IS NULL OR v_veiculo->>'termica' = 'seco') THEN 10 WHEN pf.aceita_refrigerada THEN 10 ELSE 0 END +
      CASE WHEN COALESCE(pf.score_interno, 0) >= 0.8 THEN 10 WHEN COALESCE(pf.score_interno, 0) >= 0.5 THEN 5 ELSE 0 END + 10 +
      CASE WHEN pf.tipo_veiculo IS NOT NULL THEN 10 ELSE 0 END
    )::NUMERIC AS score_match
  FROM prestadores_filtrados pf
  WHERE (v_veiculo IS NULL OR v_veiculo = '{}'::jsonb OR pf.tipo_veiculo IS NOT NULL)
  ORDER BY score_match DESC;
END;
$$;

-- ============================================================
-- 9. Função para aceitar oportunidade (ponto único de aceite)
-- ============================================================
CREATE OR REPLACE FUNCTION f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_result JSONB;
BEGIN
  -- Verificar se oportunidade existe e está disponível
  SELECT r.os_id, r.status
  INTO v_os_id, v_status_oportunidade
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id
  FOR UPDATE; -- Lock para evitar race condition

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;

  -- Verificar se prestador está ativo
  SELECT status INTO v_prestador_status FROM prestadores WHERE id = p_prestador_id;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;

  -- Verificar se OS ainda está em estado válido
  SELECT status INTO v_os_status FROM ordens_servico WHERE id = v_os_id;
  IF v_os_status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;

  -- Marcar oportunidade como aceita
  UPDATE rede_oportunidades SET
    status = 'aceita',
    prestador_aceite_id = p_prestador_id,
    aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  -- Atualizar OS com prestador
  UPDATE ordens_servico SET
    prestador = (SELECT nome_completo FROM prestadores WHERE id = p_prestador_id),
    prestador_id = p_prestador_id
  WHERE id = v_os_id;

  -- Registrar histórico na OS
  INSERT INTO os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, 'Prestador aceitou via Rede', v_os_status, 'Sistema Rede');

  -- Remover visualizações de outros prestadores (oportunidade encerrada)
  DELETE FROM rede_visualizacoes
  WHERE oportunidade_id = p_oportunidade_id
    AND prestador_id != p_prestador_id;

  -- Se a OS estava pendente, avançar para agendada
  IF v_os_status = 'pendente' OR v_os_status = 'rascunho' THEN
    UPDATE ordens_servico SET status = 'agendada' WHERE id = v_os_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_os_id,
    'prestador_id', p_prestador_id,
    'mensagem', 'Oportunidade aceita com sucesso. Escala será criada via sincronização.'
  );
END;
$$;

-- ============================================================
-- 10. Realtime: permitir que App Motorista subscribe
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rede_oportunidades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rede_visualizacoes;
