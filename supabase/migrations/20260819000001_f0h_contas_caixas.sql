-- =============================================================================
-- F0-H — CONTAS & CAIXAS (migration mínima, 100% aditiva, sem reset/drop/delete)
-- Projeto: uwrvzsjtpgaifkktpepn (PRODUÇÃO)
-- Cria a estrutura real de contas/caixas que a tela Contas & Caixas procura
-- (contas_financeiras NÃO existe em produção) e o vínculo por ID das baixas.
-- Sem seed de saldos (saldo inicial NUNCA é inventado — vem do cadastro).
-- =============================================================================

-- 1. Contas / Caixas
CREATE TABLE IF NOT EXISTS public.contas_financeiras (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT NOT NULL,
    tipo             TEXT NOT NULL DEFAULT 'Conta Corrente', -- corrente | poupanca | caixa | carteira/pix
    banco            TEXT,
    agencia          TEXT,
    numero_conta     TEXT,
    digito           TEXT,
    titular          TEXT,
    chave_pix        TEXT,
    saldo            NUMERIC(14,2) NOT NULL DEFAULT 0,          -- legado (não é fonte de saldo real)
    saldo_inicial    NUMERIC(14,2) NOT NULL DEFAULT 0,          -- saldo inicial REAL (cadastrado)
    saldo_inicial_data DATE,                                    -- data do saldo inicial
    ativa            BOOLEAN NOT NULL DEFAULT true,
    principal        BOOLEAN NOT NULL DEFAULT false,
    empresa          TEXT DEFAULT 'Matriz (SP)',
    plano_contas     TEXT DEFAULT 'Disponibilidades',
    observacoes      TEXT,
    cor              TEXT DEFAULT '#2563eb',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.contas_financeiras IS
  'F0-H — Contas bancárias e caixas reais. Saldo real = saldo_inicial + entradas - saídas (baixas estornada=false).';
COMMENT ON COLUMN public.contas_financeiras.saldo_inicial IS 'Saldo inicial REAL da conta (cadastrado pelo gestor; nunca inventado).';
COMMENT ON COLUMN public.contas_financeiras.saldo IS 'Legado — não é fonte do saldo real (mantido para compatibilidade).';

-- Máximo UMA conta principal
CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_financeiras_principal
  ON public.contas_financeiras ((principal)) WHERE principal;

-- 2. RLS (somente authenticated; sem acesso anônimo de escrita)
ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_fin_select_auth" ON public.contas_financeiras;
CREATE POLICY "contas_fin_select_auth" ON public.contas_financeiras
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contas_fin_insert_auth" ON public.contas_financeiras;
CREATE POLICY "contas_fin_insert_auth" ON public.contas_financeiras
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "contas_fin_update_auth" ON public.contas_financeiras;
CREATE POLICY "contas_fin_update_auth" ON public.contas_financeiras
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "contas_fin_delete_auth" ON public.contas_financeiras;
CREATE POLICY "contas_fin_delete_auth" ON public.contas_financeiras
  FOR DELETE TO authenticated USING (true);

-- 3. Vínculo da baixa por ID real da conta (aditivo; mantém conta_financeira textual)
ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS conta_financeira_id UUID REFERENCES public.contas_financeiras(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.financeiro_baixas.conta_financeira_id IS
  'F0-H — Vínculo por ID real da conta/caixa (conta_financeira textual permanece como fallback/compatibilidade).';
