-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 44A — CRIAÇÃO DA TABELA ocorrencias
-- Resolve P1: tabela referenciada por TorreControle, appPrestadorService,
-- roteirizacaoService e analyticsService não existia no schema.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0. Garantir função de tenant disponível (se ainda não existir)
CREATE OR REPLACE FUNCTION public.current_tenant_id_safe()
RETURNS uuid AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant_id', true)::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. CRIAR TABELA
CREATE TABLE IF NOT EXISTS public.ocorrencias (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid DEFAULT public.current_tenant_id_safe(),
    os_id           uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    alocacao_id     uuid REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL,
    prestador_id    uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
    prestador       text,       -- legado: nome do prestador (appPrestadorService usa .eq("prestador", nome))
    cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    tipo            text NOT NULL,
    descricao       text,
    status          text DEFAULT 'pendente',
    severidade      text DEFAULT 'media',
    prioridade      text DEFAULT 'normal',
    visivel_cliente boolean DEFAULT false,
    metadata        jsonb DEFAULT '{}'::jsonb,
    evidencias      jsonb DEFAULT '[]'::jsonb,
    resolvida_em    timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_ocorrencias_os_id      ON public.ocorrencias(os_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_alocacao_id  ON public.ocorrencias(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador_id ON public.ocorrencias(prestador_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_cliente_id   ON public.ocorrencias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_created_at   ON public.ocorrencias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_tenant_id    ON public.ocorrencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_tipo         ON public.ocorrencias(tipo);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status       ON public.ocorrencias(status);

-- 3. TRIGGER updated_at
CREATE OR REPLACE FUNCTION public.ocorrencias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocorrencias_updated_at ON public.ocorrencias;
CREATE TRIGGER trg_ocorrencias_updated_at
    BEFORE UPDATE ON public.ocorrencias
    FOR EACH ROW
    EXECUTE FUNCTION public.ocorrencias_updated_at();

-- 4. ENABLE RLS
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES (compatível com multi-tenant)

-- SELECT: anon e authenticated veem ocorrências do seu tenant
DROP POLICY IF EXISTS "ocorrencias_select_tenant" ON public.ocorrencias;
CREATE POLICY "ocorrencias_select_tenant" ON public.ocorrencias
    FOR SELECT TO anon, authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- INSERT: authenticated pode criar ocorrências no seu tenant
DROP POLICY IF EXISTS "ocorrencias_insert_tenant" ON public.ocorrencias;
CREATE POLICY "ocorrencias_insert_tenant" ON public.ocorrencias
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- UPDATE: authenticated pode atualizar ocorrências do seu tenant
DROP POLICY IF EXISTS "ocorrencias_update_tenant" ON public.ocorrencias;
CREATE POLICY "ocorrencias_update_tenant" ON public.ocorrencias
    FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- DELETE: authenticated pode remover ocorrências do seu tenant
DROP POLICY IF EXISTS "ocorrencias_delete_tenant" ON public.ocorrencias;
CREATE POLICY "ocorrencias_delete_tenant" ON public.ocorrencias
    FOR DELETE TO authenticated
    USING (tenant_id = public.current_tenant_id_safe());

-- 6. SUPABASE REALTIME (usado por TorreControle.tsx)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ocorrencias'
    ) THEN
        -- já está na publication
        NULL;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- publication não existe ainda
        NULL;
END $$;

-- 7. COMENTÁRIOS
COMMENT ON TABLE public.ocorrencias IS 'Ocorrências operacionais — usado por TorreControle, App Prestador, Analytics e Portal Cliente. Missão 44A.';
COMMENT ON COLUMN public.ocorrencias.prestador IS 'Nome do prestador (legado, appPrestadorService filtra por texto). Para FKs usar prestador_id.';
COMMENT ON COLUMN public.ocorrencias.visivel_cliente IS 'Se true, o cliente pode ver esta ocorrência no Portal Cliente.';
COMMENT ON COLUMN public.ocorrencias.evidencias IS 'Array de objetos {url, tipo, descricao}.';
