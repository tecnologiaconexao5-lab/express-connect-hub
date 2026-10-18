-- ═══════════════════════════════════════════════════════════════
-- CALVO 340612 — SQL PARA SQL EDITOR DO SUPABASE
-- Executar NO SQL EDITOR do Supabase Dashboard
-- (service_role bypassa RLS)
-- ═══════════════════════════════════════════════════════════════

-- PASSO 1: Popular municipios_ibge com seeds
INSERT INTO public.municipios_ibge (codigo, nome, uf) VALUES
  ('3550308', 'São Paulo', 'SP'),
  ('3509502', 'Campinas', 'SP'),
  ('3518800', 'Guarulhos', 'SP'),
  ('3524402', 'Jacareí', 'SP'),
  ('3546801', 'Santa Isabel', 'SP'),
  ('4106902', 'Curitiba', 'PR'),
  ('3118601', 'Contagem', 'MG'),
  ('3304557', 'Rio de Janeiro', 'RJ'),
  ('3106200', 'Belo Horizonte', 'MG')
ON CONFLICT (codigo) DO NOTHING;

-- PASSO 2: Verificar se SAO PAULO consta
SELECT * FROM municipios_ibge WHERE codigo = '3550308';

-- PASSO 3: Vincular documentos 340612 a uma OS
-- Buscar uma OS existente do cliente Calvo
SELECT id, numero, cliente, status FROM ordens_servico
WHERE cliente ILIKE '%calvo%' OR cliente_id IN (
  SELECT id FROM clientes WHERE razao_social ILIKE '%calvo%'
)
ORDER BY created_at DESC LIMIT 5;

-- Se houver OS, atualizar os documentos (substitua 'ID_DA_OS' pelo id real):
/*
UPDATE fiscal_documentos_vinculados
SET ordem_servico_id = 'ID_DA_OS', status = 'vinculado'
WHERE metadata->>'romaneio_numero' = '340612';
*/

-- PASSO 4: Verificar vínculo pós-update
SELECT numero, ordem_servico_id, status
FROM fiscal_documentos_vinculados
WHERE metadata->>'romaneio_numero' = '340612'
ORDER BY numero;
