-- ============================================
-- TABELAS DE VALORES - Tabela de preços por km
-- ============================================

-- Tabela principal de valores
CREATE TABLE IF NOT EXISTS public.tabelas_valores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    tipo_veiculo TEXT NOT NULL,
    km_inicial INTEGER NOT NULL DEFAULT 0,
    km_final INTEGER NOT NULL,
    valor_base NUMERIC(10,2) DEFAULT 0,
    valor_km NUMERIC(10,2) DEFAULT 0,
    valor_minimo NUMERIC(10,2) DEFAULT 0,
    pedagio_incluso BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    universal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.tabelas_valores ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow all on tabelas_valores" ON public.tabelas_valores;
CREATE POLICY "Allow all on tabelas_valores" ON public.tabelas_valores FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_cliente ON public.tabelas_valores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_tipo ON public.tabelas_valores(tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_faixa ON public.tabelas_valores(km_inicial, km_final);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_universal ON public.tabelas_valores(universal);

-- Inserir tabela universal básica (tipos comuns de veículos)
INSERT INTO public.tabelas_valores (nome, tipo_veiculo, km_inicial, km_final, valor_base, valor_km, valor_minimo, pedagio_incluso, ativo, universal) VALUES
-- Fiorino (pequeno)
('Universal', 'fiorino', 0, 10, 80.00, 4.50, 80.00, false, true, true),
('Universal', 'fiorino', 11, 30, 80.00, 4.00, 125.00, false, true, true),
('Universal', 'fiorino', 31, 50, 80.00, 3.50, 220.00, false, true, true),
('Universal', 'fiorino', 51, 100, 80.00, 3.00, 290.00, false, true, true),
('Universal', 'fiorino', 101, 200, 80.00, 2.80, 430.00, false, true, true),
('Universal', 'fiorino', 201, 9999, 80.00, 2.50, 710.00, false, true, true),

-- HR / Utilitário
('Universal', 'hr', 0, 10, 120.00, 5.50, 120.00, false, true, true),
('Universal', 'hr', 11, 30, 120.00, 5.00, 175.00, false, true, true),
('Universal', 'hr', 31, 50, 120.00, 4.50, 290.00, false, true, true),
('Universal', 'hr', 51, 100, 120.00, 4.00, 390.00, false, true, true),
('Universal', 'hr', 101, 200, 120.00, 3.50, 590.00, false, true, true),
('Universal', 'hr', 201, 9999, 120.00, 3.00, 890.00, false, true, true),

-- Van
('Universal', 'van', 0, 10, 150.00, 6.50, 150.00, false, true, true),
('Universal', 'van', 11, 30, 150.00, 6.00, 225.00, false, true, true),
('Universal', 'van', 31, 50, 150.00, 5.50, 385.00, false, true, true),
('Universal', 'van', 51, 100, 150.00, 5.00, 535.00, false, true, true),
('Universal', 'van', 101, 200, 150.00, 4.50, 785.00, false, true, true),
('Universal', 'van', 201, 9999, 150.00, 4.00, 1235.00, false, true, true),

-- VUC
('Universal', 'vuc', 0, 10, 180.00, 7.50, 180.00, false, true, true),
('Universal', 'vuc', 11, 30, 180.00, 7.00, 285.00, false, true, true),
('Universal', 'vuc', 31, 50, 180.00, 6.50, 465.00, false, true, true),
('Universal', 'vuc', 51, 100, 180.00, 6.00, 705.00, false, true, true),
('Universal', 'vuc', 101, 200, 180.00, 5.50, 1045.00, false, true, true),
('Universal', 'vuc', 201, 9999, 180.00, 5.00, 1585.00, false, true, true),

-- Truck
('Universal', 'truck', 0, 10, 250.00, 9.50, 250.00, false, true, true),
('Universal', 'truck', 11, 30, 250.00, 9.00, 395.00, false, true, true),
('Universal', 'truck', 31, 50, 250.00, 8.50, 655.00, false, true, true),
('Universal', 'truck', 51, 100, 250.00, 8.00, 955.00, false, true, true),
('Universal', 'truck', 101, 200, 250.00, 7.50, 1455.00, false, true, true),
('Universal', 'truck', 201, 9999, 250.00, 7.00, 2255.00, false, true, true),

-- Toco
('Universal', 'toco', 0, 10, 220.00, 8.50, 220.00, false, true, true),
('Universal', 'toco', 11, 30, 220.00, 8.00, 355.00, false, true, true),
('Universal', 'toco', 31, 50, 220.00, 7.50, 595.00, false, true, true),
('Universal', 'toco', 51, 100, 220.00, 7.00, 875.00, false, true, true),
('Universal', 'toco', 101, 200, 220.00, 6.50, 1295.00, false, true, true),
('Universal', 'toco', 201, 9999, 220.00, 6.00, 1975.00, false, true, true),

-- Bitrem
('Universal', 'bitrem', 0, 10, 350.00, 12.00, 350.00, false, true, true),
('Universal', 'bitrem', 11, 30, 350.00, 11.50, 545.00, false, true, true),
('Universal', 'bitrem', 31, 50, 350.00, 11.00, 905.00, false, true, true),
('Universal', 'bitrem', 51, 100, 350.00, 10.50, 1355.00, false, true, true),
('Universal', 'bitrem', 101, 200, 350.00, 10.00, 2055.00, false, true, true),
('Universal', 'bitrem', 201, 9999, 350.00, 9.50, 3255.00, false, true, true),

-- Carreta
('Universal', 'carreta', 0, 10, 400.00, 14.00, 400.00, false, true, true),
('Universal', 'carreta', 11, 30, 400.00, 13.50, 635.00, false, true, true),
('Universal', 'carreta', 31, 50, 400.00, 13.00, 1045.00, false, true, true),
('Universal', 'carreta', 51, 100, 400.00, 12.50, 1595.00, false, true, true),
('Universal', 'carreta', 101, 200, 400.00, 12.00, 2395.00, false, true, true),
('Universal', 'carreta', 201, 9999, 400.00, 11.50, 3795.00, false, true, true),

-- Moto
('Universal', 'moto', 0, 10, 40.00, 2.50, 40.00, false, true, true),
('Universal', 'moto', 11, 30, 40.00, 2.00, 65.00, false, true, true),
('Universal', 'moto', 31, 50, 40.00, 1.80, 105.00, false, true, true),
('Universal', 'moto', 51, 100, 40.00, 1.50, 145.00, false, true, true),
('Universal', 'moto', 101, 200, 40.00, 1.20, 205.00, false, true, true),
('Universal', 'moto', 201, 9999, 40.00, 1.00, 325.00, false, true, true)
ON CONFLICT DO NOTHING;