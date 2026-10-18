-- ══════════════════════════════════════════════════════════════════════════════
-- MISSÃO — Inicialização Local: tabelas_valores
-- Schema extraído da Produção em 2026-07-24 via pg (schema only, sem dados).
-- ATENÇÃO: Apenas estrutura. Sem INSERT, sem seeds, sem RLS, sem índices
--          (adicionados por migrations posteriores com IF NOT EXISTS).
--          Coluna tenant_id omitida intencionalmente:
--          será adicionada por 20260705_m76_p0_precificacao_engine.sql
--          (quando current_tenant_id_safe() já existir).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tabelas_valores (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo_veiculo text NOT NULL,
    km_inicial numeric DEFAULT 0,
    km_final numeric DEFAULT 999999,
    valor_base numeric DEFAULT 0,
    valor_km numeric DEFAULT 0,
    valor_minimo numeric DEFAULT 0,
    ativo boolean DEFAULT true,
    universal boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    adicionais jsonb DEFAULT '{}'::jsonb,
    financeiro jsonb DEFAULT '{}'::jsonb,
    regras jsonb DEFAULT '{}'::jsonb,
    faixas jsonb DEFAULT '[]'::jsonb,
    observacoes text,
    status text DEFAULT 'ATIVA'::text,
    cliente text,
    updated_at timestamp without time zone DEFAULT now(),
    arredondamento jsonb DEFAULT '{}'::jsonb,
    centro_custo_padrao text,
    conta_contabil_padrao text,
    custo_teto_prestador numeric DEFAULT 0,
    markup_desejavel numeric DEFAULT 0,
    km_franquia numeric DEFAULT 0,
    valor_km_excedente numeric DEFAULT 0,
    exigencia_termica text,
    metodos_cobranca jsonb DEFAULT '{}'::jsonb,
    classificacao_termica text,
    cobranca_principais text[] DEFAULT '{}'::text[],
    minimo_faturavel numeric(12,2) DEFAULT 0,
    cobranca_retorno jsonb DEFAULT '{"cobrado": false, "percentual": 0}'::jsonb,
    conta_contabil text,
    franquia_km numeric,
    custo_prestador numeric,
    markup_percent numeric,
    custo_minimo_prestador numeric DEFAULT 0,
    margem_minima_percent numeric DEFAULT 0,
    unidade text,
    tipo_operacao text,
    segmento_cliente text,
    data_inicio date,
    data_fim date,
    versao integer DEFAULT 1,
    tipo_tabela text,
    subcategoria_veiculo text,
    percentual_prestador numeric(5,2) DEFAULT 80,
    valor_cliente numeric DEFAULT 0,
    tipo_repasse_prestador text DEFAULT 'percentual'::text,
    valor_fixo_prestador numeric DEFAULT 0,
    motivo_alteracao text,
    prioridade integer DEFAULT 0,
    PRIMARY KEY (id)
);
