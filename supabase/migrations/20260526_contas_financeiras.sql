-- ============================================
-- Migration: Contas Financeiras (Caixas/Bancos)
-- Permite selecionar conta de pagamento nos
-- lançamentos financeiros
-- ============================================

CREATE TABLE IF NOT EXISTS public.contas_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'Conta Corrente',
    banco TEXT,
    agencia TEXT,
    numero_conta TEXT,
    digito TEXT,
    titular TEXT,
    saldo NUMERIC(12,2) DEFAULT 0,
    saldo_inicial NUMERIC(12,2) DEFAULT 0,
    ativa BOOLEAN DEFAULT true,
    principal BOOLEAN DEFAULT false,
    empresa TEXT DEFAULT 'Matriz (SP)',
    plano_contas TEXT DEFAULT 'Disponibilidades',
    observacoes TEXT,
    cor TEXT DEFAULT '#2563eb',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on contas_financeiras" ON public.contas_financeiras;
DROP POLICY IF EXISTS "Allow all on contas_financeiras" ON public.contas_financeiras;
DROP POLICY IF EXISTS "Allow all on contas_financeiras" ON contas_financeiras;
CREATE POLICY "Allow all on contas_financeiras" ON contas_financeiras
    FOR ALL USING (true) WITH CHECK (true);

-- Seed com contas iniciais (mesmo mock do ContasBancarias)
INSERT INTO public.contas_financeiras (nome, tipo, banco, agencia, numero_conta, digito, titular, saldo, saldo_inicial, ativa, principal, empresa, plano_contas, observacoes, cor) VALUES
    ('Conta Corrente Principal', 'Conta Corrente', 'Itaú Unibanco', '1234', '56789', '0', 'Express Connect Transportes LTDA', 145000.50, 100000, true, true, 'Matriz (SP)', 'Disponibilidades', '', '#2563eb'),
    ('Conta Reserva / Impostos', 'Conta Poupança', 'Bradesco', '4321', '98765', '4', 'Express Connect Transportes LTDA', 85200.00, 80000, true, false, 'Matriz (SP)', 'Reservas', 'Reserva para tributos', '#7c3aed'),
    ('Cartão Corporativo Digital', 'Conta Digital', 'Nubank', '0001', '11223344', '5', 'Express Connect Hub', 12500.00, 10000, true, false, 'Matriz (SP)', 'Disponibilidades', '', '#8b5cf6'),
    ('Caixa Interno — Pequenos Gastos', 'Caixa Físico', '—', '—', '—', '—', 'Financeiro Interno', 1250.75, 2000, true, false, 'Matriz (SP)', 'Caixa Geral', 'Reposição mensal: R$ 2.000', '#0891b2')
ON CONFLICT DO NOTHING;

-- Alterar coluna arquivo de VARCHAR(255) para TEXT (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagamentos_prestadores'
      AND column_name = 'arquivo'
  ) THEN
    ALTER TABLE public.pagamentos_prestadores
      ALTER COLUMN arquivo TYPE TEXT
      USING arquivo::TEXT;
  END IF;
END $$;


