-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 108-G — TABELA DE VALORES ENTERPRISE DEFINITIVA
--
-- ETAPAS:
--   2. Hierarquia oficial: valor_negociado → contrato → específica → padrão → universal → fallback
--   4. Vigência: data_inicio, data_fim, versao, motivo_alteracao
--   5. Prioridade: campo prioridade (maior = mais prioritária)
--   6. Simulador: via engine TS (sem gravação)
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1 — Versão e vigência em tabelas_valores
-- =============================================================================
ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1;

ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT;

ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0;

COMMENT ON COLUMN public.tabelas_valores.versao IS
  'Versão da tabela. Incrementada a cada alteração. Histórico preservado.';

COMMENT ON COLUMN public.tabelas_valores.prioridade IS
  'Prioridade da tabela. Maior valor = mais prioritária. Usada quando múltiplas tabelas são válidas.';

-- =============================================================================
-- SEÇÃO 2 — Versão e vigência em tabela_prestador
-- =============================================================================
ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS data_inicio DATE;

ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS data_fim DATE;

ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1;

ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT;

ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0;

COMMENT ON COLUMN public.tabela_prestador.data_inicio IS
  'Início da vigência da tabela do prestador';

COMMENT ON COLUMN public.tabela_prestador.data_fim IS
  'Fim da vigência. NULL = vigência indefinida.';

-- =============================================================================
-- SEÇÃO 3 — Função auxiliar: registrar histórico de alteração de tabela
-- =============================================================================
CREATE OR REPLACE FUNCTION public.f_log_tabela_alteracao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.versao := COALESCE(OLD.versao, 0) + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tabelas_valores_version ON public.tabelas_valores;
CREATE TRIGGER trg_tabelas_valores_version
  BEFORE UPDATE ON public.tabelas_valores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_log_tabela_alteracao();

DROP TRIGGER IF EXISTS trg_tabela_prestador_version ON public.tabela_prestador;
CREATE TRIGGER trg_tabela_prestador_version
  BEFORE UPDATE ON public.tabela_prestador
  FOR EACH ROW
  EXECUTE FUNCTION public.f_log_tabela_alteracao();

-- =============================================================================
-- SEÇÃO 4 — View consolidada de hierarquia (para debug e auditoria)
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_hierarquia_tabelas AS
SELECT
  'tabelas_valores' as tipo,
  t.id,
  t.nome,
  t.cliente,
  t.tipo_veiculo,
  t.valor_base,
  t.franquia_km,
  t.valor_km_excedente,
  t.percentual_prestador,
  t.universal,
  t.data_inicio,
  t.data_fim,
  t.versao,
  t.prioridade,
  t.ativo,
  t.created_at,
  t.updated_at,
  CASE WHEN t.universal THEN 3
       WHEN t.cliente IS NOT NULL AND t.data_inicio IS NOT NULL THEN 1
       WHEN t.cliente IS NOT NULL THEN 2
       ELSE 4
  END as nivel_hierarquia
FROM public.tabelas_valores t
WHERE t.ativo = true
UNION ALL
SELECT
  'tabela_prestador' as tipo,
  tp.id,
  tp.nome,
  tp.prestador_id::text as cliente,
  tp.tipo_veiculo,
  tp.valor_minimo as valor_base,
  tp.km_incluso as franquia_km,
  tp.valor_km as valor_km_excedente,
  0 as percentual_prestador,
  false as universal,
  tp.data_inicio,
  tp.data_fim,
  tp.versao,
  tp.prioridade,
  tp.ativo,
  tp.created_at,
  tp.updated_at,
  0 as nivel_hierarquia
FROM public.tabela_prestador tp
WHERE tp.ativo = true;

COMMENT ON VIEW public.vw_hierarquia_tabelas IS
  'M108G — View consolidada de todas as tabelas de preço (cliente + prestador) para auditoria.';

-- =============================================================================
-- SEÇÃO 5 — Índices
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_versao ON public.tabelas_valores(versao);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_prioridade ON public.tabelas_valores(prioridade);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_versao ON public.tabela_prestador(versao);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_vigencia ON public.tabela_prestador(data_inicio, data_fim);
