-- ============================================================
-- BASELINE: Tabelas externas ao chain de migrations
-- Criado para garantir que a cadeia de migrations seja
-- autossuficiente em banco vazio, sem depender de arquivos
-- SQL externos (sql/ia_automacao_central.sql, etc.)
--
-- Tabelas:
--   - ia_setores (referenciada por ia_conhecimento)
--   - ia_conhecimento (referenciada por f25fa3_treinamento_arquivos_ia.sql)
--   - pagamentos_prestadores (referenciada por 20260526_contas_financeiras.sql)
--   - pagamentos_prestadores_itens (referenciada por FK chain)
--
-- Objetivo: incluir todas as colunas comprovadamente necessárias
-- para que migrations subsequentes nao falhem com
-- "relation does not exist" ou "column does not exist".
-- Colunas que exigem FK para tabelas ainda nao existentes
-- (ex: automacoes_robos, tenants) sao deixadas para as
-- migrations que criam essas tabelas.
--
-- Fontes de verdade consolidadas:
--   - sql/ia_automacao_central.sql (estrutura base)
--   - 20260627_f25c_instrucoes_conhecimento_robos.sql (colunas expandidas)
--   - 20260706_f29_biblioteca_corporativa.sql (biblioteca corporativa)
--   - sql_pagamentos_prestadores.sql (estrutura base)
--   - sql/alter_pagamentos_prestadores_profissional.sql (padrao profissional)
--   - sql/alter_pagamentos_prestadores_fechamento_conta_corrente.sql (fechamento)
--   - 20260706_m103a_fix_alocacao_trigger_columns.sql (trigger columns)
--   - 20260705_m80_remocao_duplicidade_financeira.sql (trigger columns)
--   - src/services/financeiro/pagamentoPrestadorService.ts (TS code columns)
--
-- Colunas EXCLUIDAS intencionalmente (adicionadas por migrations
-- posteriores com FK para tabelas que ainda nao existem):
--   - ia_conhecimento.robo_id (F25C adiciona com FK automacoes_robos)
--   - pagamentos_prestadores.tenant_id (missao15 adiciona com FK tenants)
-- ============================================================

-- ============================================================
-- 1. ia_setores — setores da IA
-- Fonte: sql/ia_automacao_central.sql + F21
-- modo_operacao e fallback_msg sao adicionados por F21
--   (preserva CHECK constraint da migracao original)
-- ============================================================
CREATE TABLE IF NOT EXISTS ia_setores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    descricao text,
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ia_conhecimento — base de conhecimento da IA
-- Fontes: sql/ia_automacao_central.sql (base)
--         F25C (categoria, setor, tags, status,
--               validade_inicio, validade_fim, criado_por,
--               atualizado_por, atualizado_em + CHECK status)
--         F29  (tipo_conhecimento, versao, aprovado_por,
--               data_aprovacao)
-- EXCLUIDO: robo_id (adicionado por F25C com FK automacoes_robos)
-- ============================================================
CREATE TABLE IF NOT EXISTS ia_conhecimento (
    -- PK
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vinculo com setor (sem FK robo_id — F25C adiciona)
    setor_id uuid REFERENCES ia_setores(id) ON DELETE SET NULL,

    -- Conteudo
    titulo text NOT NULL DEFAULT '',
    conteudo text NOT NULL DEFAULT '',
    categoria text,
    setor text,
    tags text[] DEFAULT '{}',

    -- Arquivo
    url_arquivo text,

    -- Status e vigencia (F25C)
    status text NOT NULL DEFAULT 'ativo',
    validade_inicio date,
    validade_fim date,

    -- Versionamento e aprovacao (F29)
    tipo_conhecimento text NOT NULL DEFAULT 'outro',
    versao integer NOT NULL DEFAULT 1,
    aprovado_por uuid,
    data_aprovacao timestamptz,

    -- Auditoria
    ativo boolean DEFAULT true,
    criado_por uuid,
    atualizado_por uuid,
    criado_em timestamptz DEFAULT now(),
    atualizado_em timestamptz DEFAULT now(),

    -- CHECK constraint de status (F25C adiciona com IF NOT EXISTS)
    CONSTRAINT ia_conhecimento_status_check
        CHECK (status IN ('ativo', 'inativo', 'vencido', 'rascunho'))
);

-- ============================================================
-- 3. pagamentos_prestadores — pagamentos a prestadores
-- Fontes: sql_pagamentos_prestadores.sql
--         alter_pagamentos_prestadores_profissional.sql
--         alter_pagamentos_prestadores_fechamento_conta_corrente.sql
--         M103A, M80 (triggers)
--         pagamentoPrestadorService.ts (TS code)
--
-- Colunas divergentes (nomes diferentes, usos distintos):
--   quantidade_os (triggers/TS)  vs  qtd_os (fechamento)
--   pedagio/adicionais (triggers) vs valor_pedagio/valor_adicionais (prof.)
--   observacao (TS/profissional) vs observacoes (original SQL)
--   competencia (triggers/fechamento) vs data_competencia (TS/profissional)
--   arquivo (profissional/baseline) vs cnab_arquivo (original SQL)
-- EXCLUIDO: tenant_id (adicionado por missao15 com FK tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS pagamentos_prestadores (
    -- PK
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Prestador
    prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
    prestador_nome text,
    prestador_documento text,

    -- Cliente
    cliente_id uuid,
    cliente_nome text,

    -- OS vinculada
    os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    os_numero text,

    -- Periodo de referencia
    periodo_inicio date,
    periodo_fim date,
    data_competencia date,
    competencia date,

    -- Datas de pagamento
    data_prevista_pagamento date,
    data_programada_pagamento date,
    data_pagamento date,

    -- ================================================================
    -- VALORES — multiplos sistemas de nomenclatura
    -- ================================================================

    -- Original sql_pagamentos_prestadores.sql
    quantidade_os integer DEFAULT 0,
    valor_servicos numeric(10,2) DEFAULT 0,
    valor_reembolsos numeric(10,2) DEFAULT 0,
    valor_bonus numeric(10,2) DEFAULT 0,
    valor_descontos numeric(10,2) DEFAULT 0,
    valor_adiantamentos numeric(10,2) DEFAULT 0,
    valor_liquido numeric(10,2) DEFAULT 0,

    -- Profissional (nomes com prefixo valor_)
    valor numeric(10,2) DEFAULT 0,
    valor_pedagio numeric(10,2) DEFAULT 0,
    valor_estacionamento numeric(10,2) DEFAULT 0,
    valor_combustivel numeric(10,2) DEFAULT 0,
    valor_adicionais numeric(10,2) DEFAULT 0,
    valor_multas numeric(10,2) DEFAULT 0,
    valor_ajustes numeric(10,2) DEFAULT 0,

    -- Fechamento (nomes sem prefixo)
    qtd_os integer DEFAULT 0,
    pedagio numeric DEFAULT 0,
    reembolsos numeric DEFAULT 0,
    adicionais numeric DEFAULT 0,
    descontos numeric DEFAULT 0,
    adiantamentos numeric DEFAULT 0,
    multas numeric DEFAULT 0,
    ajustes numeric DEFAULT 0,

    -- Dados bancarios
    banco text,
    agencia text,
    conta text,
    conta_tipo text,
    chave_pix text,

    -- Classificacao do lancamento
    tipo_lancamento text,
    natureza text DEFAULT 'credito',
    tipo_pagamento text,
    origem_lancamento text DEFAULT 'manual',
    categoria_financeira text,
    centro_custo text,
    conta_contabil text,

    -- Status
    status text DEFAULT 'pendente',
    status_conferencia text DEFAULT 'em_aberto',
    status_pagamento text DEFAULT 'pendente',
    status_aprovacao text DEFAULT 'aguardando_aprovacao',

    -- Forma de pagamento
    forma_pagamento text,
    conta_pagamento text,

    -- Observacoes
    observacao text,
    observacoes text,

    -- Arquivos / CNAB
    arquivo text,
    cnab_lote_id text,
    cnab_arquivo text,
    elegivel_lote boolean DEFAULT false,
    lote_id uuid,

    -- Impacto financeiro
    impacto_dre boolean DEFAULT true,
    impacto_fluxo_caixa boolean DEFAULT true,

    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. pagamentos_prestadores_itens — itens do pagamento
-- Fonte: sql_pagamentos_prestadores.sql
-- Tabela estavel — nenhuma migration posterior adiciona colunas
-- ============================================================
CREATE TABLE IF NOT EXISTS pagamentos_prestadores_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pagamento_id uuid REFERENCES pagamentos_prestadores(id) ON DELETE CASCADE,
    os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    os_numero text,
    valor_servico numeric(10,2) DEFAULT 0,
    pedagio numeric(10,2) DEFAULT 0,
    adicional numeric(10,2) DEFAULT 0,
    valor_reembolso numeric(10,2) DEFAULT 0,
    valor_bonus numeric(10,2) DEFAULT 0,
    valor_desconto numeric(10,2) DEFAULT 0,
    observacao text,
    status text DEFAULT 'pendente',
    created_at timestamptz DEFAULT now()
);
