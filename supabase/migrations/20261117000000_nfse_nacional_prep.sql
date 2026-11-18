-- ===================================================================
-- MISSÃO NFS-e NACIONAL — Preparação do banco
-- Data: 2026-11-17
--
-- Objetivo: preparar Storage, certificados, matriz e regra oficial
-- para o novo motor de NFS-e (Padrão Nacional / SEFIN), SEM tocar em
-- CT-e/MDF-e e SEM duplicar estruturas já existentes.
--
-- Estruturas REUSADAS (schema real conferido em produção):
--   * storage.buckets ............ certificados-fiscais (privado, 10MB, p12)
--   * public.certificados_fiscais  (emitente_id -> configuracoes_fiscais)
--   * public.configuracoes_fiscais (ie, inscricao_municipal, codigo_ibge,
--                                    crt, regime_tributario)
--   * public.regras_fiscais_nfse   (municipio_prestacao, codigo_servico,
--                                    descricao_servico, aliquota_iss)
--
-- DECISÕES:
--   1. NÃO criar o bucket "fiscal-certificados": já existe
--      "certificados-fiscais" (privado) com o mesmo propósito.
--   2. NÃO criar a tabela "fiscal_certificates": já existe
--      "certificados_fiscais" (FK para configuracoes_fiscais). Ela é
--      estendida com validade_inicio/validade_fim/senha_hash/metadata.
--   3. Adicionar "metadata JSONB" em configuracoes_fiscais e
--      regras_fiscais_nfse (não existia) para campos do Padrão Nacional.
--
-- Idempotente: pode ser reexecutada sem duplicar dados.
-- A transação é controlada pelo script de aplicação
-- (scripts/_apply_nfse_nacional_prep.cjs), NÃO por este arquivo.
-- ===================================================================

-- ===================================================================
-- 1) STORAGE — bucket privado de certificados
--    Reuso do bucket existente + policies de storage.objects
--    (não havia NENHUMA policy para este bucket — upload seria negado).
-- ===================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados-fiscais',
  'certificados-fiscais',
  false,
  10485760,
  ARRAY['application/x-pkcs12', 'application/octet-stream', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "certificados_fiscais_select" ON storage.objects;
CREATE POLICY "certificados_fiscais_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'certificados-fiscais');

DROP POLICY IF EXISTS "certificados_fiscais_insert" ON storage.objects;
CREATE POLICY "certificados_fiscais_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados-fiscais');

DROP POLICY IF EXISTS "certificados_fiscais_update" ON storage.objects;
CREATE POLICY "certificados_fiscais_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'certificados-fiscais')
  WITH CHECK (bucket_id = 'certificados-fiscais');

DROP POLICY IF EXISTS "certificados_fiscais_delete" ON storage.objects;
CREATE POLICY "certificados_fiscais_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'certificados-fiscais');

-- ===================================================================
-- 2) CERTIFICADOS — extensão da tabela existente
-- ===================================================================
ALTER TABLE public.certificados_fiscais
  ADD COLUMN IF NOT EXISTS validade_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS validade_fim    timestamptz,
  ADD COLUMN IF NOT EXISTS senha_hash      text,
  ADD COLUMN IF NOT EXISTS metadata        jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Default alinhado ao vocabulário já documentado:
-- 'pendente / enviado / ativo / expirado / revogado'
ALTER TABLE public.certificados_fiscais
  ALTER COLUMN status SET DEFAULT 'ativo';

CREATE INDEX IF NOT EXISTS idx_cert_validade_fim
  ON public.certificados_fiscais(validade_fim);

COMMENT ON COLUMN public.certificados_fiscais.senha_hash IS
  'Hash da senha do certificado (bcrypt/argon2). NUNCA armazenar a senha em texto puro.';
COMMENT ON COLUMN public.certificados_fiscais.validade_inicio IS
  'Início da validade extraída do certificado A1 (notBefore).';
COMMENT ON COLUMN public.certificados_fiscais.validade_fim IS
  'Fim da validade extraída do certificado A1 (notAfter).';
COMMENT ON COLUMN public.certificados_fiscais.metadata IS
  'Metadados do certificado para o motor NFS-e Nacional (serial, emissor, algoritmo, etc.).';

-- ===================================================================
-- 3) CONFIGURAÇÕES FISCAIS — metadata + matriz
-- ===================================================================
ALTER TABLE public.configuracoes_fiscais
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.configuracoes_fiscais.metadata IS
  'Extras por motor fiscal (ex.: nfse_nacional.municipio_ibge, codigo_tributacao_nacional).';

-- 3.1) Garante a linha da matriz (CNPJ 31.227.975/0001-80)
INSERT INTO public.configuracoes_fiscais (
  razao_social, nome_fantasia, cnpj, ie, inscricao_municipal,
  codigo_ibge, cidade, uf, regime_tributario, crt,
  ativo, padrao, ambiente_fiscal, metadata
)
SELECT
  'CONEXAO TRANSPORTES LTDA',
  'CONEXAO TRANSPORTES LTDA',
  '31.227.975/0001-80',
  '119836105110',
  '60458216',
  '3550308',
  'SAO PAULO',
  'SP',
  'Simples Nacional (ME)',
  '1',
  true,
  false,
  'homologacao',
  jsonb_build_object(
    'nfse_nacional', jsonb_build_object(
      'habilitado', true,
      'municipio_ibge', '3550308',
      'codigo_tributacao_nacional', '16.02.01.002'
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracoes_fiscais
  WHERE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = '31227975000180'
);

-- 3.2) Normaliza os dados da matriz (reexecução idempotente)
UPDATE public.configuracoes_fiscais
SET razao_social        = 'CONEXAO TRANSPORTES LTDA',
    ie                  = '119836105110',
    inscricao_municipal = '60458216',
    codigo_ibge         = '3550308',
    cidade              = 'SAO PAULO',
    uf                  = 'SP',
    regime_tributario   = 'Simples Nacional (ME)',
    crt                 = '1',
    ativo               = true,
    metadata            = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'nfse_nacional', jsonb_build_object(
        'habilitado', true,
        'municipio_ibge', '3550308',
        'codigo_tributacao_nacional', '16.02.01.002'
      )
    )
WHERE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = '31227975000180';

-- 3.3) NÃO troca o emitente padrão existente.
--      A matriz entra como ativa e padrao=false. O emitente padrão atual
--      (outra empresa) permanece inalterado — decisão do operador para não
--      afetar CT-e/MDF-e que usam buscarEmitentePadrao().
--      Salvaguarda: se a matriz já estiver como padrão E existir outro
--      padrão (estado inválido), demove apenas a matriz.
UPDATE public.configuracoes_fiscais cf
SET padrao = false
WHERE regexp_replace(coalesce(cf.cnpj, ''), '\D', '', 'g') = '31227975000180'
  AND cf.padrao = true
  AND EXISTS (
    SELECT 1 FROM public.configuracoes_fiscais x
    WHERE x.padrao = true AND x.id <> cf.id
  );

-- ===================================================================
-- 4) REGRAS FISCAIS NFS-e — regra oficial de emissão nacional
--    municipio_prestacao guarda o código IBGE (3550308) para o motor
--    nacional. A UI legada consulta por nome ("SAO PAULO") — ver nota
--    no relatório (follow-up: lookup por IBGE).
-- ===================================================================
ALTER TABLE public.regras_fiscais_nfse
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.regras_fiscais_nfse.metadata IS
  'Extras da regra para o motor NFS-e Nacional (codigo_tributacao_nacional, municipio_ibge, NBS, etc.).';

INSERT INTO public.regras_fiscais_nfse (
  emitente_id, cliente_id, municipio_prestacao, uf,
  codigo_servico, descricao_servico, aliquota_iss, iss_retido,
  observacao, ativo, metadata
)
SELECT
  (SELECT id FROM public.configuracoes_fiscais
    WHERE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = '31227975000180'
    ORDER BY created_at LIMIT 1),
  NULL,
  '3550308',
  'SP',
  '16.02.01.002',
  'Transporte de bens ou valores',
  0.00,
  false,
  'NFS-e Padrão Nacional (SEFIN) — Código Tributação Nacional 16.02.01.002; Município IBGE 3550308 (São Paulo/SP); alíquota 0.00 (Simples Nacional).',
  true,
  jsonb_build_object(
    'origem', 'nfse_nacional',
    'codigo_tributacao_nacional', '16.02.01.002',
    'municipio_ibge', '3550308'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.regras_fiscais_nfse
  WHERE municipio_prestacao = '3550308'
    AND codigo_servico = '16.02.01.002'
);

-- 4.1) Normaliza a regra (reexecução idempotente)
UPDATE public.regras_fiscais_nfse
SET uf                  = 'SP',
    descricao_servico   = 'Transporte de bens ou valores',
    aliquota_iss        = 0.00,
    iss_retido          = false,
    ativo               = true,
    emitente_id         = coalesce(
      emitente_id,
      (SELECT id FROM public.configuracoes_fiscais
        WHERE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = '31227975000180'
        ORDER BY created_at LIMIT 1)
    ),
    metadata            = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'origem', 'nfse_nacional',
      'codigo_tributacao_nacional', '16.02.01.002',
      'municipio_ibge', '3550308'
    )
WHERE municipio_prestacao = '3550308'
  AND codigo_servico = '16.02.01.002';

-- Recarrega o cache de schema do PostgREST (efetiva no COMMIT da transação)
NOTIFY pgrst, 'reload schema';
