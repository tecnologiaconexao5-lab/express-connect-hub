-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 76 — FUNDAÇÃO P0 DO ENGINE DE PRECIFICAÇÃO
-- 
-- 1. Adiciona tenant_id em tabelas_valores (se não existir)
-- 2. Adiciona tenant_id em tabela_prestador (se não existir)
-- 3. Cria índices por tenant_id
-- 4. Aplica RLS segura por tenant
-- 5. Unifica franquia_km / km_franquia sem perda de dados
-- 6. Garante trigger M66 ativa e remove trigger P0 regressiva
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- 1. TENANT_ID EM tabelas_valores
-- =============================================================================
ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.current_tenant_id_safe();

COMMENT ON COLUMN public.tabelas_valores.tenant_id IS 'Identificador do tenant (multi-tenant)';

CREATE INDEX IF NOT EXISTS idx_tabelas_valores_tenant
  ON public.tabelas_valores(tenant_id);

-- Backfill para dados existentes (caso tenant_id = 00000000-0000-0000-0000-000000000001)
-- Ajuste conforme necessidade do tenant real
UPDATE public.tabelas_valores
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

-- =============================================================================
-- 2. RLS EM tabelas_valores
-- =============================================================================
-- Remove política antiga permissiva
DROP POLICY IF EXISTS "Allow all on tabelas_valores" ON public.tabelas_valores;

-- Políticas por tenant
CREATE POLICY "tv_select_tenant" ON public.tabelas_valores
  FOR SELECT TO anon, authenticated
  USING (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tv_insert_tenant" ON public.tabelas_valores
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tv_update_tenant" ON public.tabelas_valores
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tv_delete_tenant" ON public.tabelas_valores
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id_safe());

-- =============================================================================
-- 3. UNIFICAR franquia_km / km_franquia
-- =============================================================================
-- Adiciona coluna franquia_km se não existir
ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS franquia_km numeric DEFAULT 0;

-- Copia dados de km_franquia para franquia_km (se km_franquia existe e franquia_km está vazio)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tabelas_valores' AND column_name = 'km_franquia'
  ) THEN
    UPDATE public.tabelas_valores
      SET franquia_km = COALESCE(km_franquia, 0)
      WHERE franquia_km IS NULL OR franquia_km = 0;
  END IF;
END $$;

COMMENT ON COLUMN public.tabelas_valores.franquia_km IS 'Quantidade de KM inclusos na franquia (sem custo adicional)';

-- =============================================================================
-- 4. TENANT_ID + RLS EM tabela_prestador
-- =============================================================================
ALTER TABLE public.tabela_prestador
  ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.current_tenant_id_safe();

COMMENT ON COLUMN public.tabela_prestador.tenant_id IS 'Identificador do tenant (multi-tenant)';

CREATE INDEX IF NOT EXISTS idx_tabela_prestador_tenant
  ON public.tabela_prestador(tenant_id);

-- Backfill
UPDATE public.tabela_prestador
  SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

-- RLS
ALTER TABLE public.tabela_prestador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tp_select_tenant" ON public.tabela_prestador
  FOR SELECT TO anon, authenticated
  USING (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tp_insert_tenant" ON public.tabela_prestador
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tp_update_tenant" ON public.tabela_prestador
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id_safe());

CREATE POLICY "tp_delete_tenant" ON public.tabela_prestador
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id_safe());

-- =============================================================================
-- 5. GARANTIR TRIGGER M66 ATIVA E P0 DESATIVADA
-- =============================================================================
-- Remove trigger P0 regressiva (31/07) se existir
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao_p0 ON alocacoes_escala;
DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_alocacao_p0();

-- Garante que a trigger M66 é a única ativa (idempotente)
-- A trigger M66 foi criada em 20260704_m66_fix_propagacao_financeira.sql
-- Este bloco assegura que ela existe e está correta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_propagar_financeiro_alocacao'
      AND tgrelid = 'alocacoes_escala'::regclass
  ) THEN
    RAISE WARNING 'Trigger M66 (trg_propagar_financeiro_alocacao) não encontrada. Execute 20260704_m66_fix_propagacao_financeira.sql manualmente.';
  END IF;
END $$;

-- =============================================================================
-- 6. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_cliente_veiculo
  ON public.tabelas_valores(cliente, tipo_veiculo);

CREATE INDEX IF NOT EXISTS idx_tabelas_valores_universal_veiculo
  ON public.tabelas_valores(universal, tipo_veiculo);

CREATE INDEX IF NOT EXISTS idx_tabela_prestador_busca
  ON public.tabela_prestador(nome, tipo_veiculo, uf);

-- =============================================================================
-- 7. GARANTIR COLUNA percentual_prestador EM tabelas_valores
-- =============================================================================
ALTER TABLE public.tabelas_valores
  ADD COLUMN IF NOT EXISTS percentual_prestador numeric DEFAULT 80;

COMMENT ON COLUMN public.tabelas_valores.percentual_prestador IS 'Percentual padrão de repasse ao prestador (default 80%)';

-- =============================================================================
-- 8. LOG DE DOCUMENTAÇÃO
-- =============================================================================
COMMENT ON TABLE public.tabelas_valores IS 'Tabela de preços comerciais (cliente). Missão 76: adicionado tenant_id, RLS, franquia_km, percentual_prestador';
COMMENT ON TABLE public.tabela_prestador IS 'Tabela de custos operacionais (prestador). Missão 76: adicionado tenant_id e RLS';
