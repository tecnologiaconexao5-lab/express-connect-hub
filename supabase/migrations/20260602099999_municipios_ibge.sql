-- Tabela de municipios IBGE para codigos municipais fiscais
CREATE TABLE IF NOT EXISTS public.municipios_ibge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  uf text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_municipios_ibge_codigo ON municipios_ibge(codigo);
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_nome_uf ON municipios_ibge(nome, uf);

ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.municipios_ibge;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON municipios_ibge;
CREATE POLICY "Enable select for authenticated users" ON municipios_ibge
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.municipios_ibge;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON municipios_ibge;
CREATE POLICY "Enable insert for authenticated users" ON municipios_ibge
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Seeds iniciais: municipios de teste
INSERT INTO public.municipios_ibge (codigo, nome, uf) VALUES
  ('3550308', 'São Paulo', 'SP'),
  ('3509502', 'Campinas', 'SP'),
  ('4106902', 'Curitiba', 'PR'),
  ('3118601', 'Contagem', 'MG'),
  ('3518800', 'Guarulhos', 'SP'),
  ('3304557', 'Rio de Janeiro', 'RJ'),
  ('3106200', 'Belo Horizonte', 'MG'),
  ('5002704', 'Campo Grande', 'MS'),
  ('5208707', 'Goiânia', 'GO'),
  ('2927408', 'Salvador', 'BA'),
  ('2611606', 'Recife', 'PE'),
  ('4205407', 'Florianópolis', 'SC'),
  ('4314902', 'Porto Alegre', 'RS'),
  ('5300108', 'Brasília', 'DF')
ON CONFLICT (codigo) DO NOTHING;


