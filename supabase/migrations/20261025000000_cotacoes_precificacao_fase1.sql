-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO COTACAO-EXPRESS-V2
-- Precificacao automatica na Fase 1 (preco na hora)
-- Data: 2026-10-25
--
-- OBJETIVO: a Fase 1 passa a calcular o frete em tempo real
-- (Mapbox Directions + edge `pedido-rapido` action "estimar") e
-- gravar a cotacao com o valor calculado, aguardando a aprovacao
-- do proprio cliente na tela. Para isso sao necessarios 2 ajustes
-- de schema:
--
--   1. STATUS: novo valor 'Pendente de Aprovação pelo Cliente'
--      (a cotaacao ja nasce com rota + preco, diferente do
--      'Pendente' legado de quem so pre-cadastrou os enderecos).
--   2. METADATA: coluna jsonb nova para guardar a precificacao
--      (valor, km, veiculo, fonte, formula) e as coordenadas das
--      paradas — sem ela nao ha onde persistir o calculo.
--
-- IDEMPOTENTE: pode ser re-executada sem quebrar (drop condicional
-- do CHECK + ADD COLUMN IF NOT EXISTS).
--
-- CONTRATO DE STATUS (4 valores):
--   'Pendente'                          → legado (Fase 1 sem preco)
--   'Pendente de Aprovação pelo Cliente'→ Fase 1 com preco na tela
--   'Aguardando Detalhes'               → cliente aprovou (Fase 2 liberada)
--   'Pronto para OS'                    → Fase 2 preenchida
-- ============================================================

-- ------------------------------------------------------------
-- SECAO 1: novo CHECK de status (substitui o de 3 valores)
-- ------------------------------------------------------------
DO $$
DECLARE
    cons RECORD;
BEGIN
    -- Remove QUALQUER CHECK constraint da coluna status (nome conhecido
    -- 'cotacoes_publicas_status_check', mas com varredura para nao
    -- deixar a constraint antiga viva caso o nome tenha mudado).
    FOR cons IN
        SELECT c.conname
          FROM pg_constraint c
         WHERE c.conrelid = 'public.cotacoes_publicas'::regclass
           AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.cotacoes_publicas DROP CONSTRAINT %I', cons.conname);
    END LOOP;

    ALTER TABLE public.cotacoes_publicas
        ADD CONSTRAINT cotacoes_publicas_status_check
        CHECK (status IN (
            'Pendente',
            'Pendente de Aprovação pelo Cliente',
            'Aguardando Detalhes',
            'Pronto para OS'
        ));
END $$;

-- ------------------------------------------------------------
-- SECAO 2: metadata (precificacao + coordenadas da rota)
-- ------------------------------------------------------------
ALTER TABLE public.cotacoes_publicas
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Indice GIN para consultas ao payload de precificacao
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_metadata
    ON public.cotacoes_publicas USING GIN (metadata);

-- ------------------------------------------------------------
-- SECAO 3: recarga do schema do PostgREST + realtime
-- ------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes_publicas;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;

NOTIFY pgrst, 'reload schema';

-- FIM DA MIGRATION
