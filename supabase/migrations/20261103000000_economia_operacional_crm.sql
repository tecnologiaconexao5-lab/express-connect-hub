-- Correções e unit economics: endereço no CRM, consumo/manutenção de veículos
-- e histórico de preços de combustível.

-- 1) CRM: endereço no lead
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS endereco TEXT;

-- 2) Veículos/Prestadores: parâmetros de consumo e manutenção
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS media_consumo_km_l NUMERIC,
  ADD COLUMN IF NOT EXISTS custo_manutencao_km NUMERIC,
  ADD COLUMN IF NOT EXISTS tipo_combustivel TEXT;

ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS media_consumo_km_l NUMERIC,
  ADD COLUMN IF NOT EXISTS custo_manutencao_km NUMERIC,
  ADD COLUMN IF NOT EXISTS tipo_combustivel TEXT;

CREATE INDEX IF NOT EXISTS idx_veiculos_consumo_manutencao ON public.veiculos (media_consumo_km_l, custo_manutencao_km);

-- 3) Histórico de preços de combustível (ANP / simulado)
CREATE TABLE IF NOT EXISTS public.combustivel_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combustivel TEXT NOT NULL,
  preco NUMERIC(10,4) NOT NULL CHECK (preco > 0),
  uf TEXT DEFAULT 'SP',
  municipio TEXT DEFAULT '',
  fonte TEXT NOT NULL DEFAULT 'ANP (simulado)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID DEFAULT current_tenant_id_safe()
);

CREATE INDEX IF NOT EXISTS idx_combustivel_precos_tipo ON public.combustivel_precos (combustivel, created_at DESC);

ALTER TABLE public.combustivel_precos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "combustivel_precos_select" ON public.combustivel_precos;
DROP POLICY IF EXISTS "combustivel_precos_insert" ON public.combustivel_precos;
CREATE POLICY "combustivel_precos_select" ON public.combustivel_precos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "combustivel_precos_insert" ON public.combustivel_precos
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT ON public.combustivel_precos TO authenticated;
GRANT SELECT, INSERT ON public.combustivel_precos TO service_role;

NOTIFY pgrst, 'reload schema';
