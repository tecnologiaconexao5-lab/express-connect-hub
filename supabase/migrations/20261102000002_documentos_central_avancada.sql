-- Central Inteligente de Documentos — campos de organização, versão e histórico.
-- Complementa `documentos_metadata` sem alterar o arquivo original de versões antigas.

ALTER TABLE public.documentos_metadata
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'Operacional',
  ADD COLUMN IF NOT EXISTS departamento TEXT,
  ADD COLUMN IF NOT EXISTS entidade_nome TEXT,
  ADD COLUMN IF NOT EXISTS responsavel TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS documento_pai_id UUID REFERENCES public.documentos_metadata(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS historico JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.documentos_metadata DROP CONSTRAINT IF EXISTS documentos_metadata_categoria_check;
ALTER TABLE public.documentos_metadata ADD CONSTRAINT documentos_metadata_categoria_check
  CHECK (categoria IN ('Comercial', 'Operacional', 'Financeiro', 'Recrutamento', 'Administrativo'));

ALTER TABLE public.documentos_metadata DROP CONSTRAINT IF EXISTS documentos_metadata_status_ia_check;
ALTER TABLE public.documentos_metadata ADD CONSTRAINT documentos_metadata_status_ia_check
  CHECK (status_ia IN (
    'pendente',
    'processando',
    'aprovado_na_conferencia',
    'aprovado_com_ressalvas',
    'com_ressalvas',
    'necessita_de_correcao',
    'aguardando_conferencia_humana',
    'erro'
  ));

-- Backfill de organização a partir da origem/entidade existente.
UPDATE public.documentos_metadata
SET categoria = CASE
  WHEN modulo_origem = 'comercial' THEN 'Comercial'
  WHEN modulo_origem = 'financeiro' THEN 'Financeiro'
  WHEN modulo_origem = 'recrutamento' THEN 'Recrutamento'
  WHEN modulo_origem = 'prestadores' THEN 'Recrutamento'
  WHEN modulo_origem = 'administrativo' THEN 'Administrativo'
  ELSE 'Operacional'
END
WHERE categoria = 'Operacional'
  AND modulo_origem IN ('comercial', 'financeiro', 'recrutamento', 'prestadores', 'administrativo');

UPDATE public.documentos_metadata m
SET entidade_nome = COALESCE(p.nome_fantasia, p.nome_completo)
FROM public.prestadores p
WHERE m.entidade_nome IS NULL
  AND m.modulo_origem = 'prestadores'
  AND m.entidade_id = p.id;

UPDATE public.documentos_metadata
SET responsavel = COALESCE(responsavel, 'Operação')
WHERE responsavel IS NULL OR responsavel = '';

CREATE INDEX IF NOT EXISTS idx_documentos_metadata_categoria ON public.documentos_metadata (categoria);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_departamento ON public.documentos_metadata (departamento);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_entidade_nome ON public.documentos_metadata (entidade_nome);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_responsavel ON public.documentos_metadata (responsavel);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_ativo ON public.documentos_metadata (ativo);
CREATE INDEX IF NOT EXISTS idx_documentos_metadata_versao_pai ON public.documentos_metadata (documento_pai_id);

NOTIFY pgrst, 'reload schema';
