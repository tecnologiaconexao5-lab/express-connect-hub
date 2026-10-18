-- ============================================================
-- EXPRESS CONNECT HUB / TMS
-- Enterprise Hardening Migration
-- Data: 2026-06-26
-- Auditoria Enterprise Completa — Onda 1 + Onda 2
-- ============================================================

-- ============================================================
-- SEÇÃO 1: SEGURANÇA — Habilitar RLS em tabelas sem proteção
-- ============================================================

-- 1.1 Tabelas sem RLS (P0)
ALTER TABLE IF EXISTS escala_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS motorista_app_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS motorista_checkins ENABLE ROW LEVEL SECURITY;

-- 1.2 Políticas mínimas para tabelas recém-protegidas
-- (apenas leitura para anon, escrita exige authenticated)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'escala_operacional') THEN
        DROP POLICY IF EXISTS "anon_select_escala_operacional" ON escala_operacional;
        CREATE POLICY "anon_select_escala_operacional" ON escala_operacional
            FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'motorista_app_sessoes') THEN
        DROP POLICY IF EXISTS "anon_select_motorista_sessoes" ON motorista_app_sessoes;
        CREATE POLICY "anon_select_motorista_sessoes" ON motorista_app_sessoes
            FOR SELECT TO anon USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'motorista_checkins') THEN
        DROP POLICY IF EXISTS "anon_select_motorista_checkins" ON motorista_checkins;
        CREATE POLICY "anon_select_motorista_checkins" ON motorista_checkins
            FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- ============================================================
-- SEÇÃO 2: SEGURANÇA — Revogar GRANT ALL de tabelas sensíveis
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ia_credenciais') THEN
    REVOKE ALL ON ia_credenciais FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ia_identidades') THEN
    REVOKE ALL ON ia_identidades FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ia_sessoes_operacionais') THEN
    REVOKE ALL ON ia_sessoes_operacionais FROM anon;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Políticas restritivas para estas tabelas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ia_credenciais') THEN
        DROP POLICY IF EXISTS "ia_credenciais_select_authenticated" ON ia_credenciais;
        CREATE POLICY "ia_credenciais_select_authenticated" ON ia_credenciais
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ia_identidades') THEN
        DROP POLICY IF EXISTS "ia_identidades_select_authenticated" ON ia_identidades;
        CREATE POLICY "ia_identidades_select_authenticated" ON ia_identidades
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- ============================================================
-- SEÇÃO 3: SEGURANÇA — Proteger funções SECURITY DEFINER
-- ============================================================

-- Adiciona search_path = '' para prevenir search path hijacking
DO $$
DECLARE
    r RECORD;
    func_args text;
BEGIN
    FOR r IN
        SELECT p.proname, n.nspname, pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND p.proname IN (
              'trg_escala_validacoes',
              'trg_ia_logs_escalonamento',
              'fn_dispatcher_automacao',
              'obter_cliente_id_do_usuario',
              'criar_alocacao_escala',
              'atualizar_status_escala',
              'obter_escala_por_os',
              'obter_resumo_escala',
              'registrar_checkin_motorista',
              'obter_rota_ativa'
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = '''';', r.nspname, r.proname, r.args);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter function %: %', r.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================
-- SEÇÃO 4: INTEGRIDADE — Alinhar os_id para UUID
-- ============================================================

-- 4.1 Verificar dados inválidos antes da conversão (rodar manualmente)
-- SELECT os_id FROM financeiro_receber WHERE os_id IS NOT NULL AND os_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 4.2 Converter colunas os_id de TEXT para UUID
DO $$
BEGIN
    -- Verifica se a coluna ainda é TEXT antes de converter
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'financeiro_receber'
          AND column_name = 'os_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE financeiro_receber ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter financeiro_receber.os_id: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'financeiro_pagar'
          AND column_name = 'os_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE financeiro_pagar ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter financeiro_pagar.os_id: %', SQLERRM;
END $$;

-- ============================================================
-- SEÇÃO 5: INTEGRIDADE — CHECK >= 0 em valores financeiros
-- ============================================================

-- 5.1 alocacoes_escala
DO $$ BEGIN
    ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_frete_pos CHECK (valor_frete >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_repasse_pos CHECK (valor_repasse >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_pedagio_pos CHECK (valor_pedagio >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5.2 financeiro_receber
DO $$ BEGIN
    ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_valor_pos CHECK (valor >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5.3 financeiro_pagar
DO $$ BEGIN
    ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_valor_pos CHECK (valor >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5.4 pagamentos_prestadores
DO $$ BEGIN
    ALTER TABLE pagamentos_prestadores ADD CONSTRAINT ck_pp_valor_pos CHECK (valor >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEÇÃO 6: INTEGRIDADE — UNIQUE constraint
-- ============================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'composicao_financeira_os') THEN
        ALTER TABLE composicao_financeira_os ADD CONSTRAINT uq_composicao_os UNIQUE (os_id);
    END IF;
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- SEÇÃO 7: INTEGRIDADE — Foreign Keys críticas
-- ============================================================

-- 7.1 OS -> Cliente
DO $$ BEGIN
    ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL; END $$;

-- 7.2 OS -> Prestador
DO $$ BEGIN
    ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_prestador
        FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL; END $$;

-- 7.3 Contratos histórico -> Contratos gerados
DO $$ BEGIN
    ALTER TABLE contratos_historico ADD CONSTRAINT fk_ch_contrato
        FOREIGN KEY (contrato_id) REFERENCES contratos_gerados(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7.4 Portal pedidos -> OS
DO $$ BEGIN
    ALTER TABLE portal_pedidos ADD CONSTRAINT fk_pp_os
        FOREIGN KEY (os_vinculada_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7.5 Portal ocorrencias -> OS
DO $$ BEGIN
    ALTER TABLE portal_ocorrencias ADD CONSTRAINT fk_po_os
        FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7.6 Portal faturas -> Cliente
DO $$ BEGIN
    ALTER TABLE portal_faturas ADD CONSTRAINT fk_pf_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7.7 Pagamentos prestadores -> Prestador
DO $$ BEGIN
    ALTER TABLE pagamentos_prestadores ADD CONSTRAINT fk_pp_prestador
        FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEÇÃO 8: INTEGRIDADE — CHECK em colunas de status
-- ============================================================

DO $$ BEGIN
    ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_status
        CHECK (status IN ('aberto', 'pago', 'vencido', 'atrasado', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_status
        CHECK (status IN ('aberto', 'pago', 'vencido', 'atrasado', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE portal_faturas ADD CONSTRAINT ck_pf_status
        CHECK (status IN ('aberta', 'a_vencer', 'vencida', 'paga', 'cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEÇÃO 9: PERFORMANCE — Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fr_cliente_status ON financeiro_receber(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_fr_os_id ON financeiro_receber(os_id);
CREATE INDEX IF NOT EXISTS idx_fr_vencimento_status ON financeiro_receber(data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_fp_fornecedor_status ON financeiro_pagar(fornecedor_id, status);
CREATE INDEX IF NOT EXISTS idx_pp_prestador_status ON pagamentos_prestadores(prestador_id, status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pp_os_id ON pagamentos_prestadores(os_id);
CREATE INDEX IF NOT EXISTS idx_os_prestador_status ON ordens_servico(prestador_id, status);
CREATE INDEX IF NOT EXISTS idx_os_cliente_status ON ordens_servico(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_pp_os_vinculada ON portal_pedidos(os_vinculada_id);
CREATE INDEX IF NOT EXISTS idx_ch_contrato ON contratos_historico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_ae_prestador_data_status ON alocacoes_escala(prestador_id, data_escala, status);

-- ============================================================
-- SEÇÃO 10: AUDITORIA — Trigger de auditoria financeira
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_receber_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receber_id UUID NOT NULL,
    valor_anterior NUMERIC,
    valor_novo NUMERIC,
    status_anterior TEXT,
    status_novo TEXT,
    changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fra_receber_id ON financeiro_receber_audit(receber_id);

CREATE OR REPLACE FUNCTION audit_financeiro_receber()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.valor IS DISTINCT FROM NEW.valor OR OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO financeiro_receber_audit (receber_id, valor_anterior, valor_novo, status_anterior, status_novo)
        VALUES (OLD.id, OLD.valor, NEW.valor, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger existente se houver e recria
DROP TRIGGER IF EXISTS trg_audit_financeiro_receber ON financeiro_receber;
CREATE TRIGGER trg_audit_financeiro_receber
    AFTER UPDATE ON financeiro_receber
    FOR EACH ROW
    EXECUTE FUNCTION audit_financeiro_receber();

-- ============================================================
-- SEÇÃO 11: DEPRECATION — Marcar escala_operacional
-- ============================================================

COMMENT ON TABLE escala_operacional IS 'DEPRECATED — use alocacoes_escala instead. Kept for backward compatibility only.';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
