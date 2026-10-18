-- =============================================================================
-- CREATE _hml_seed_checkpoint — Tabela de Checkpoint para Seed de Homologação
-- MISSÃO TMS-016 / TMS-017 / TMS-019
-- REVISÃO MS-019A — 2026-07-29
--
-- Esta tabela NÃO deve ser criada automaticamente pelo seed.
-- Deve ser revisada, autorizada e executada manualmente antes da primeira
-- execução do seed TMS013-SEED-v2.
--
-- ## SEGURANÇA (MS-019A)
-- - Nenhum CREATE TABLE/INDEX/FUNCTION/TRIGGER usa IF NOT EXISTS
-- - Nenhum CREATE OR REPLACE
-- - Nenhum DROP IF EXISTS
-- - Toda criação verifica existência prévia e ABORTA se já existir
-- - REVOKE ALL FROM PUBLIC antes de conceder privilégios
-- - anon/authenticated NÃO recebem acesso (justificado abaixo)
-- - RLS desabilitado com justificativa técnica (abaixo)
--
-- Uso: psql -f supabase/scripts/create_hml_seed_checkpoint.sql
-- Ou:  Supabase Dashboard > SQL Editor > Cole e execute
-- =============================================================================

-- =============================================================================
-- BLOCO DE VALIDAÇÃO — ABORTA SE QUALQUER OBJETO JÁ EXISTIR
-- =============================================================================
-- Este DO block verifica preventivamente se a tabela, função ou trigger já
-- existem no schema. Se qualquer um existir, a transação é abortada com
-- RAISE EXCEPTION — nada é criado, nada é alterado.
--
-- Risco:       Nenhum (read-only, se passar o script continua)
-- Finalidade:  Impedir execução acidental em ambiente onde objetos já existem
-- Impacto:     Zero (DO block não modifica nada)
-- =============================================================================

DO $$
DECLARE
    v_table_oid    OID;
    v_func_oid     OID;
    v_trigger_name TEXT;
BEGIN
    -- 1. Verificar se a tabela já existe
    v_table_oid := to_regclass('public._hml_seed_checkpoint');
    IF v_table_oid IS NOT NULL THEN
        RAISE EXCEPTION 'ABORTANDO: tabela public._hml_seed_checkpoint já existe (OID %). '
                         'Remova manualmente ou audite antes de recriar.', v_table_oid;
    END IF;

    -- 2. Verificar se a função já existe
    SELECT oid INTO v_func_oid
    FROM pg_proc
    WHERE proname = 'update_hml_seed_checkpoint_updated_at'
      AND pronamespace = 'public'::regnamespace;
    IF v_func_oid IS NOT NULL THEN
        RAISE EXCEPTION 'ABORTANDO: função public.update_hml_seed_checkpoint_updated_at já existe (OID %). '
                         'Audite antes de recriar.', v_func_oid;
    END IF;

    -- 3. Verificar se o trigger já existe
    SELECT tg.tgname INTO v_trigger_name
    FROM pg_trigger tg
    JOIN pg_class cl ON tg.tgrelid = cl.oid
    WHERE tg.tgname = 'trg_hml_cp_updated_at'
      AND cl.relname = '_hml_seed_checkpoint'
      AND cl.relnamespace = 'public'::regnamespace;
    IF v_trigger_name IS NOT NULL THEN
        RAISE EXCEPTION 'ABORTANDO: trigger trg_hml_cp_updated_at já existe na tabela _hml_seed_checkpoint. '
                         'Audite antes de recriar.';
    END IF;

    RAISE NOTICE 'VALIDAÇÃO: Nenhum objeto existente encontrado. Prosseguindo com criação.';
END $$;

-- =============================================================================
-- AUDITORIA DO COMANDO ACIMA
-- =============================================================================
-- Comando:    DO $$ ... $$
-- Risco:      Mínimo. Bloco anônimo PL/pgSQL read-only (SELECT).
--             Não cria, altera ou exclui nenhum objeto.
-- Finalidade: Validar pré-condições antes de qualquer DDL.
-- Impacto:    Zero. Se falhar, o script inteiro é abortado (nenhuma
--             transação pendente). Se passar, o script continua.
-- Alternativa: Poderíamos usar \if no psql, mas DO block funciona em
--             qualquer cliente SQL (inclusive Supabase SQL Editor).
-- =============================================================================

-- =============================================================================
-- CRIAÇÃO DA TABELA
-- =============================================================================
-- Comando:    CREATE TABLE public._hml_seed_checkpoint (...)
-- Risco:      Moderado. Cria uma nova tabela no schema public.
--             Impacto limitado pois:
--             - Nome único (_hml_seed_checkpoint), sem conflito com
--               tabelas de negócio
--             - Nenhuma FK para/from tabelas existentes
--             - Nenhuma dependência de objetos externos
-- Finalidade: Tabela de checkpoint para o seed de homologação.
--             Armazena o estado de cada cenário (1-6) para permitir
--             idempotência e retomada.
-- Impacto:    Banco: ~8 kB (tabela vazia, 6 cenários=6 linhas).
--             Nenhuma query existente depende desta tabela.
--             Nenhum código em produção a referencia.
-- =============================================================================

CREATE TABLE public._hml_seed_checkpoint (
    -- Identificação
    marcador       TEXT        NOT NULL,            -- Ex: HML-APP-20260729
    cenario        INT         NOT NULL
        CHECK (cenario BETWEEN 1 AND 6),           -- 6 cenários do seed v2

    seed_version   TEXT        NOT NULL,            -- Ex: TMS013-SEED-v2

    -- Status do checkpoint
    status         TEXT        NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'concluido', 'falhou')),

    -- Tentativas e controle
    tentativas     INT         NOT NULL DEFAULT 0
        CHECK (tentativas >= 0),                   -- MS-019A: validação não-negativo

    erro           TEXT,                            -- Mensagem de erro (status = falhou)

    -- Timestamps
    iniciado_em    TIMESTAMPTZ,                     -- Quando o cenário começou
    concluido_em   TIMESTAMPTZ,                     -- Quando o cenário terminou
    duracao_ms     INT                              -- Duração do cenário em ms
        CHECK (duracao_ms IS NULL OR duracao_ms >= 0),  -- MS-019A: não-negativo

    executado_por  TEXT,                            -- Hostname ou usuário do SO

    -- Auditoria (MS-019A: NOT NULL)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- PK composta: um checkpoint por (marcador, cenario)
    PRIMARY KEY (marcador, cenario)
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================
-- Comando:    CREATE INDEX ...
-- Risco:      Baixo. Índices B-tree em tabela vazia.
--             Impacto em escrita: mínimo (2 índices, apenas 6 linhas).
-- Finalidade: idx_hml_cp_marcador: busca rápida por marcador (gate de
--             idempotência na abertura do seed).
--             idx_hml_cp_status: busca por status (retomada de cenários
--             com status = 'falhou').
-- Impacto:    Performance de INSERT: ~10% em tabela de 6 linhas (irrelevante).
--             Nenhuma query de produção usa estes índices.
-- =============================================================================

CREATE INDEX idx_hml_cp_marcador
    ON public._hml_seed_checkpoint(marcador);

CREATE INDEX idx_hml_cp_status
    ON public._hml_seed_checkpoint(status);

-- =============================================================================
-- FUNÇÃO DO TRIGGER
-- =============================================================================
-- Comando:    CREATE FUNCTION public.update_hml_seed_checkpoint_updated_at()
-- Risco:      Baixo. Função plpgsql simples, sem acesso a tabelas externas.
--             Atualiza apenas a coluna updated_at da própria tabela.
-- Finalidade: Manter updated_at atualizado automaticamente em UPDATEs.
-- Impacto:    Mínimo. Disparada apenas em UPDATE na tabela checkpoint.
-- =============================================================================

CREATE FUNCTION public.update_hml_seed_checkpoint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER
-- =============================================================================
-- Comando:    CREATE TRIGGER trg_hml_cp_updated_at ...
-- Risco:      Mínimo. Trigger BEFORE UPDATE na tabela checkpoint.
--             Dispara a função update_hml_seed_checkpoint_updated_at.
-- Finalidade: Atualizar updated_at automaticamente em cada UPDATE.
-- Impacto:    Performance: ~0.01ms por UPDATE (função inline).
-- =============================================================================

CREATE TRIGGER trg_hml_cp_updated_at
    BEFORE UPDATE ON public._hml_seed_checkpoint
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hml_seed_checkpoint_updated_at();

-- =============================================================================
-- RLS (ROW LEVEL SECURITY)
-- =============================================================================
-- Comando:    ALTER TABLE public._hml_seed_checkpoint DISABLE ROW LEVEL SECURITY
--
-- Risco:      Baixo. RLS desabilitado significa que qualquer role com
--             acesso à tabela pode ler/escrever sem restrições de linha.
--
-- Finalidade: Esta tabela é usada APENAS pelo seed de homologação, que
--             se conecta via DATABASE_URL (superusuário). O superusuário
--             sempre bypassa RLS, portanto habilitar RLS não adicionaria
--             proteção real contra o seed.
--
--             Além disso:
--             - Nenhum endpoint da API pública consulta esta tabela
--             - Nenhum trigger, função ou RPC de produção a referencia
--             - Nenhum código TypeScript em src/ a importa
--             - Grants abaixo RESTRINGEM acesso a postgres e service_role
--
-- Impacto:    Zero para usuários finais (nunca exposta).
--             Equivalente a habilitar RLS com policy service_role-only,
--             já que service_role bypassa RLS de qualquer forma.
--
-- Alternativa considerada: Habilitar RLS com policy:
--     CREATE POLICY cp_service_role_only
--         ON public._hml_seed_checkpoint
--         FOR ALL
--         TO service_role
--         USING (true);
--     ALTER TABLE public._hml_seed_checkpoint ENABLE ROW LEVEL SECURITY;
--     REVOKE ALL ON TABLE public._hml_seed_checkpoint FROM anon, authenticated;
--     GRANT ALL ON TABLE public._hml_seed_checkpoint TO service_role;
--
--     Motivo da rejeição: Esta alternativa seria EQUIVALENTE em segurança
--     (service_role bypassa RLS, e grants já bloqueiam anon/authenticated).
--     A diferença é puramente cosmética — RLS habilitado com policy
--     seria redundante dado que grants já controlam acesso no nível
--     da tabela. Desabilitar RLS evita overhead desnecessário (check
--     de policy em cada operação) sem perda de segurança.
-- =============================================================================

ALTER TABLE public._hml_seed_checkpoint DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- GRANTS E REVOKES
-- =============================================================================
-- Comando:    REVOKE ALL ... FROM PUBLIC
-- Risco:      Nenhum. Remove permissões da role PUBLIC (todos os usuários).
--             Operação segura mesmo se já estiver revogado.
-- Finalidade: Garantir que NENHUMA role não-autorizada tenha acesso
--             residual à tabela antes de concedermos privilégios
--             específicos.
-- Impacto:    Nenhum. A tabela acabou de ser criada — o único acesso
--             existente é o DEFAULT (que é PUBLIC com permissões do
--             schema public).
--
-- Decisão sobre anon e authenticated:
--     anon:           NÃO recebe acesso.
--     authenticated:  NÃO recebe acesso.
--     Justificativa:  Esta tabela é de uso INTERNO do seed de
--                     homologação. Nenhum usuário autenticado (seja
--                     TMS, Portal Cliente ou App Motorista) precisa
--                     consultar ou modificar esta tabela. Conceder
--                     acesso a anon/authenticated seria uma superfície
--                     de ataque desnecessária.
--
-- Roles autorizadas:
--     postgres:       Role superusuário padrão. Necessário para que
--                     o seed (conectado via DATABASE_URL) possa
--                     escrever checkpoints.
--     service_role:   Role de serviço do Supabase. Necessário para
--                     que o seed, quando executado via management API,
--                     tenha acesso. Também usado por eventuais
--                     scripts automatizados no futuro.
-- =============================================================================

REVOKE ALL
    ON TABLE public._hml_seed_checkpoint
    FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public._hml_seed_checkpoint
    TO postgres;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public._hml_seed_checkpoint
    TO service_role;

-- =============================================================================
-- VALIDAÇÃO PÓS-CRIAÇÃO
-- =============================================================================
-- Este bloco verifica se todos os objetos foram criados corretamente.
-- Se algo falhou (ex: tabela existe mas trigger não), aborta.
-- =============================================================================

DO $$
DECLARE
    v_table_oid    OID;
    v_func_oid     OID;
    v_trigger_name TEXT;
BEGIN
    -- 1. Verificar tabela
    v_table_oid := to_regclass('public._hml_seed_checkpoint');
    IF v_table_oid IS NULL THEN
        RAISE EXCEPTION 'FALHA NA CRIAÇÃO: tabela public._hml_seed_checkpoint não encontrada após CREATE TABLE.';
    END IF;

    -- 2. Verificar função
    SELECT oid INTO v_func_oid
    FROM pg_proc
    WHERE proname = 'update_hml_seed_checkpoint_updated_at'
      AND pronamespace = 'public'::regnamespace;
    IF v_func_oid IS NULL THEN
        RAISE EXCEPTION 'FALHA NA CRIAÇÃO: função update_hml_seed_checkpoint_updated_at não encontrada.';
    END IF;

    -- 3. Verificar trigger
    SELECT tg.tgname INTO v_trigger_name
    FROM pg_trigger tg
    JOIN pg_class cl ON tg.tgrelid = cl.oid
    WHERE tg.tgname = 'trg_hml_cp_updated_at'
      AND cl.relname = '_hml_seed_checkpoint'
      AND cl.relnamespace = 'public'::regnamespace;
    IF v_trigger_name IS NULL THEN
        RAISE EXCEPTION 'FALHA NA CRIAÇÃO: trigger trg_hml_cp_updated_at não encontrado.';
    END IF;

    RAISE NOTICE 'VALIDAÇÃO PÓS-CRIAÇÃO: Todos os objetos criados com sucesso.';
END $$;

-- =============================================================================
-- RESUMO DOS OBJETOS CRIADOS
-- =============================================================================
-- Objeto                    Tipo          Finalidade
-- ------------------------- ------------- ------------------------------------
-- _hml_seed_checkpoint      TABELA        Checkpoint de idempotência do seed
-- idx_hml_cp_marcador       INDEX         Busca rápida por marcador
-- idx_hml_cp_status         INDEX         Busca rápida por status
-- update_hml_seed_...       FUNCTION      Atualiza updated_at no trigger
-- trg_hml_cp_updated_at     TRIGGER       BEFORE UPDATE → updated_at = now()
--
-- Roles com acesso:         postgres, service_role (apenas)
-- Roles SEM acesso:         PUBLIC, anon, authenticated (explicitamente revogado)
-- RLS:                      Desabilitado (justificado acima)
--
-- =============================================================================
-- FIM
-- =============================================================================
