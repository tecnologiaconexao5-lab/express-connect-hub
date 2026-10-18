-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 129-C
-- Restaurar o Contrato Oficial de Reembolsos do Prestador (P0)
-- Data: 2026-08-05
--
-- OBJETIVO: Criar a tabela oficial `reembolsos_prestador`
-- utilizada pelo App Motorista (Flutter PWA) para enviar
-- solicitações de reembolso.
--
-- CAUSA RAIZ (E+C):
--   E: App Motorista utiliza `reembolsos_prestador` (nome legado)
--   C: Nenhuma migration criou a tabela — schema cache nunca teve
--
-- CONTRATO OFICIAL:
--   - Tabela: public.reembolsos_prestador
--   - prestador TEXT (nome) — padrão do projeto para tabelas do app
--   - tenant_id via current_tenant_id_safe()
--   - RLS multi-tenant (padrão Missão 16/18)
--   - authenticated pode INSERT (prestador logado)
--   - anon pode SELECT (consulta de status)
-- ============================================================

-- ============================================================
-- SECAO 1: CRIACAO DA TABELA OFICIAL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reembolsos_prestador (
    -- PK
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Vinculos
    prestador TEXT NOT NULL,                          -- Nome do prestador (TEXT, padrao app)
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,

    -- Dados do reembolso
    tipo TEXT NOT NULL,                               -- pedagio, ajudante, estadia, diaria, outros
    descricao TEXT,
    valor NUMERIC NOT NULL CHECK (valor >= 0),
    data_despesa DATE NOT NULL,
    comprovante_url TEXT,

    -- Workflow de aprovacao
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente','aprovado','rejeitado','pago')),
    aprovado_por UUID,
    data_aprovacao TIMESTAMPTZ,
    obs_rejeicao TEXT,

    -- Multi-tenant (segue padrao Missao 16/18)
    tenant_id UUID DEFAULT public.current_tenant_id_safe(),

    -- Auditoria
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECAO 2: INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rp_prestador
    ON public.reembolsos_prestador(prestador);

CREATE INDEX IF NOT EXISTS idx_rp_status
    ON public.reembolsos_prestador(status);

CREATE INDEX IF NOT EXISTS idx_rp_os_id
    ON public.reembolsos_prestador(os_id);

CREATE INDEX IF NOT EXISTS idx_rp_tenant_id
    ON public.reembolsos_prestador(tenant_id);

CREATE INDEX IF NOT EXISTS idx_rp_created_at
    ON public.reembolsos_prestador(created_at DESC);

-- ============================================================
-- SECAO 3: TRIGGER UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_reembolsos_prestador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rp_updated_at ON public.reembolsos_prestador;
CREATE TRIGGER trg_rp_updated_at
    BEFORE UPDATE ON public.reembolsos_prestador
    FOR EACH ROW
    EXECUTE FUNCTION public.update_reembolsos_prestador_updated_at();

-- ============================================================
-- SECAO 4: ROW LEVEL SECURITY
-- Segue o padrao estabelecido nas Missoes 16 e 18:
--   - SELECT: anon, authenticated (com tenant isolation)
--   - INSERT: authenticated (com tenant isolation)
--   - UPDATE: authenticated (com tenant isolation)
--   - DELETE: authenticated (com tenant isolation)
-- ============================================================

ALTER TABLE public.reembolsos_prestador ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "rp_select_tenant" ON public.reembolsos_prestador;
CREATE POLICY "rp_select_tenant" ON public.reembolsos_prestador
    FOR SELECT TO anon, authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- INSERT
DROP POLICY IF EXISTS "rp_insert_tenant" ON public.reembolsos_prestador;
CREATE POLICY "rp_insert_tenant" ON public.reembolsos_prestador
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- UPDATE
DROP POLICY IF EXISTS "rp_update_tenant" ON public.reembolsos_prestador;
CREATE POLICY "rp_update_tenant" ON public.reembolsos_prestador
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- DELETE
DROP POLICY IF EXISTS "rp_delete_tenant" ON public.reembolsos_prestador;
CREATE POLICY "rp_delete_tenant" ON public.reembolsos_prestador
    FOR DELETE TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- ============================================================
-- SECAO 5: GRANTS
-- Segue o padrao: anon e authenticated tem SELECT,
-- authenticated tem INSERT/UPDATE/DELETE
-- ============================================================

GRANT SELECT ON TABLE public.reembolsos_prestador TO anon;
GRANT SELECT ON TABLE public.reembolsos_prestador TO authenticated;
GRANT INSERT ON TABLE public.reembolsos_prestador TO authenticated;
GRANT UPDATE ON TABLE public.reembolsos_prestador TO authenticated;
GRANT DELETE ON TABLE public.reembolsos_prestador TO authenticated;

-- ============================================================
-- SECAO 6: REALTIME (OPCIONAL — descomentar se necessario)
-- ============================================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.reembolsos_prestador;

-- ============================================================
-- SECAO 7: NOTIFICAR SCHEMA CACHE
-- Forca o Supabase a recarregar o schema cache,
-- essencial para o App Motorista enxergar a tabela
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
