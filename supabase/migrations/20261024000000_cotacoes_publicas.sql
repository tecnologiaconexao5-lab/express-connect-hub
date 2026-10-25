-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO COTACAO-EXPRESS
-- Tabela publica de Cotacao de Fretes (fluxo em 2 fases)
-- Data: 2026-10-24
--
-- OBJETIVO: captar cotacoes no site (rota publica /cotacao-express)
-- com baixa friccao (Fase 1 — pre-cadastro) e completar os dados
-- operacionais somente depois que o cliente aprova o valor no
-- WhatsApp (Fase 2 — /cotacao-express/detalhes/:id).
--
-- CONTRATO OFICIAL:
--   - Tabela: public.cotacoes_publicas
--   - status: 'Pendente'            → Fase 1 enviada (pre-cadastro)
--             'Aguardando Detalhes' → orcamento aprovado / link da Fase 2 gerado
--             'Pronto para OS'      → Fase 2 preenchida pelo cliente
--   - paradas  jsonb → Fase 1 [{sequencia, tipo, endereco}]  (endereco: CEP/bairro/rua)
--   - detalhes jsonb → Fase 2 [{sequencia, numero, complemento, contato, observacoes}]
--   - orcamento_id → vinculo com public.orcamentos (gerado pelo comercial)
--   - RLS: INSERT aberto para ANON (formulario publico),
--          UPDATE/SELECT de ANON restrito ao recurso (o client
--          sempre filtra por .eq("id", <id da cotacao>)),
--          authenticated com acesso total (Torre de Controle).
--   - Realtime habilitado para os alertas no layout do TMS.
-- ============================================================

-- ============================================================
-- SECAO 1: CRIACAO DA TABELA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cotacoes_publicas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Fase 1 — pre-cadastro de alta conversao
    status TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (status IN ('Pendente', 'Aguardando Detalhes', 'Pronto para OS')),

    nome_cliente TEXT,
    telefone TEXT,

    carga_descricao TEXT,
    carga_peso NUMERIC,
    carga_dimensoes TEXT,
    carga_volumes INT,

    -- Paradas da rota (Fase 1): apenas uma referencia (CEP, bairro ou rua)
    paradas JSONB NOT NULL DEFAULT '[]'::jsonb,

    data_desejada DATE,
    hora_desejada TEXT,

    -- Detalhes operacionais (Fase 2): numero, complemento, contato, observacoes
    detalhes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Vinculo com o orcamento comercial criado a partir desta cotacao
    orcamento_id UUID,
    valor_aprovado NUMERIC,

    tenant_id UUID DEFAULT public.current_tenant_id_safe(),
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECAO 2: INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_status
    ON public.cotacoes_publicas (status);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_orcamento_id
    ON public.cotacoes_publicas (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_created_at
    ON public.cotacoes_publicas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_tenant_id
    ON public.cotacoes_publicas (tenant_id);

-- ============================================================
-- SECAO 3: TRIGGER updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_cotacoes_publicas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cotacoes_publicas_updated_at ON public.cotacoes_publicas;
CREATE TRIGGER trg_cotacoes_publicas_updated_at
    BEFORE UPDATE ON public.cotacoes_publicas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cotacoes_publicas_updated_at();

-- ============================================================
-- SECAO 4: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.cotacoes_publicas ENABLE ROW LEVEL SECURITY;

-- SELECT: anon (Fase 2 carrega a cotacao pelo id na rota publica)
DROP POLICY IF EXISTS "cotacoes_publicas_select_anon" ON public.cotacoes_publicas;
CREATE POLICY "cotacoes_publicas_select_anon" ON public.cotacoes_publicas
    FOR SELECT TO anon, authenticated
    USING (true);

-- INSERT: aberto para anon (formulario publico /cotacao-express)
DROP POLICY IF EXISTS "cotacoes_publicas_insert_anon" ON public.cotacoes_publicas;
CREATE POLICY "cotacoes_publicas_insert_anon" ON public.cotacoes_publicas
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- UPDATE: anon atualiza SEMPRE pelo id da cotacao (a aplicacao envia
-- apenas .eq("id", <id>) — filtro obrigatorio no service/da pagina)
DROP POLICY IF EXISTS "cotacoes_publicas_update_anon" ON public.cotacoes_publicas;
CREATE POLICY "cotacoes_publicas_update_anon" ON public.cotacoes_publicas
    FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: apenas equipe logada (TMS)
DROP POLICY IF EXISTS "cotacoes_publicas_delete_tms" ON public.cotacoes_publicas;
CREATE POLICY "cotacoes_publicas_delete_tms" ON public.cotacoes_publicas
    FOR DELETE TO authenticated
    USING (true);

-- ============================================================
-- SECAO 5: GRANTS
-- ============================================================

GRANT SELECT ON TABLE public.cotacoes_publicas TO anon;
GRANT INSERT ON TABLE public.cotacoes_publicas TO anon;
GRANT UPDATE ON TABLE public.cotacoes_publicas TO anon;

GRANT SELECT ON TABLE public.cotacoes_publicas TO authenticated;
GRANT INSERT ON TABLE public.cotacoes_publicas TO authenticated;
GRANT UPDATE ON TABLE public.cotacoes_publicas TO authenticated;
GRANT DELETE ON TABLE public.cotacoes_publicas TO authenticated;

-- ============================================================
-- SECAO 6: REALTIME (alertas no Layout do TMS)
-- ============================================================

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes_publicas;
    EXCEPTION
        WHEN duplicate_object THEN NULL;      -- ja publicada
        WHEN undefined_object THEN NULL;      -- publication inexistente
    END;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- FIM DA MIGRATION
