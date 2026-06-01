-- Adiciona campos fiscais obrigatorios na tabela veiculos
-- P0-2: tara_kg, uf_licenciamento, tipo_rodado para payloads Focus/SEFAZ

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS tara_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS uf_licenciamento VARCHAR(2),
  ADD COLUMN IF NOT EXISTS tipo_rodado VARCHAR(30);

COMMENT ON COLUMN public.veiculos.tara_kg IS 'Tara do veiculo em kg (peso do veiculo vazio). Obrigatorio SEFAZ para CT-e e MDF-e.';
COMMENT ON COLUMN public.veiculos.uf_licenciamento IS 'UF onde o veiculo esta licenciado (ex: SP). Obrigatorio SEFAZ para MDF-e.';
COMMENT ON COLUMN public.veiculos.tipo_rodado IS 'Tipo de rodado do veiculo (ex: Truck, Toco, Carreta 2 eixos). Obrigatorio SEFAZ para MDF-e.';
