-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO A31 — PROPOSTA DE MIGRATION (ADITIVA) — NÃO APLICADA
-- A31_PROPOSTA_MIGRATION_FINANCEIRO.sql
--
-- STATUS: PROPOSTA. NÃO FOI EXECUTADA. AGUARDANDO APROVAÇÃO DO USUÁRIO.
--
-- Justificativa: a A31 foi implementada reutilizando `configuracoes_sistema`
-- (chave/valor JSON) para regras por cliente e dados financeiros, SEM migration.
-- Esta proposta registra a evolução estrutural OPICIONAL para quando a solução
-- via configuracoes_sistema não for mais suficiente (volume/relatórios/efi).
--
-- 100% ADITIVA: CREATE TABLE + ADD COLUMN. SEM DROP/TRUNCATE/RESET/DELETE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ==============================================================================
-- 1. CLIENTES — regras financeiras explícitas (hoje em configuracoes_sistema)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='modelo_fatura_padrao') THEN
    ALTER TABLE public.clientes ADD COLUMN modelo_fatura_padrao text DEFAULT 'conexao_express';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='exige_romaneio_oc') THEN
    ALTER TABLE public.clientes ADD COLUMN exige_romaneio_oc boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='email_financeiro') THEN
    ALTER TABLE public.clientes ADD COLUMN email_financeiro text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='exige_aprovacao_fatura') THEN
    ALTER TABLE public.clientes ADD COLUMN exige_aprovacao_fatura boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='regras_financeiras') THEN
    ALTER TABLE public.clientes ADD COLUMN regras_financeiras jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.clientes.modelo_fatura_padrao IS 'A31: modelo de fatura padrão (conexao_express | calvo). Elimina regra por nome do cliente.';
COMMENT ON COLUMN public.clientes.exige_romaneio_oc IS 'A31: se true, bloqueia emissão de fatura sem Romaneio/OC.';
COMMENT ON COLUMN public.clientes.email_financeiro IS 'A31: e-mail de faturamento (separado do operacional).';
COMMENT ON COLUMN public.clientes.exige_aprovacao_fatura IS 'A31: fluxo de aprovação antes da emissão.';
COMMENT ON COLUMN public.clientes.regras_financeiras IS 'A31: regras financeiras adicionais por cliente (vencimento, fechamento, observação padrão, instruções).';

-- ==============================================================================
-- 2. CONTAS FINANCEIRAS (dados bancários da empresa — hoje em configuracoes_sistema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contas_financeiras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  tipo            text NOT NULL DEFAULT 'Conta Corrente',
  banco           text,
  codigo_banco    text,
  agencia         text,
  conta           text,
  digito          text,
  pix             text,
  titular         text,
  titular_cnpj    text,
  ativa           boolean DEFAULT true,
  principal       boolean DEFAULT false,
  tenant_id       uuid NOT NULL DEFAULT current_tenant_id_safe(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.contas_financeiras IS 'A31: contas bancárias da empresa para fatura/boleto. Compatível com migration 20260526.';

-- ==============================================================================
-- 3. FATURAS — colunas dedicadas (hoje em faturas.metadata)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faturas' AND column_name='modelo') THEN
    ALTER TABLE public.faturas ADD COLUMN modelo text DEFAULT 'conexao_express';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faturas' AND column_name='descricao') THEN
    ALTER TABLE public.faturas ADD COLUMN descricao text;
  END IF;
END $$;

COMMENT ON COLUMN public.faturas.modelo IS 'A31: modelo de fatura (conexao_express | calvo) — coluna dedicada (hoje em metadata).';
COMMENT ON COLUMN public.faturas.descricao IS 'A31: descrição consolidada (ex.: Calvo romaneios) — coluna dedicada (hoje em metadata).';

-- ==============================================================================
-- FIM DA PROPOSTA (NÃO APLICADA)
-- ==============================================================================
