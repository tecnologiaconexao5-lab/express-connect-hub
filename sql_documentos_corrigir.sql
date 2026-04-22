-- ============================================================
-- CORREÇÃO: Documentos de Candidatos + Anti-duplicidade
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. Criar tabela candidato_documentos se não existir
CREATE TABLE IF NOT EXISTS public.candidato_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo TEXT,
    url_arquivo TEXT,
    validade DATE,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.candidato_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read candidato_documentos"
    ON public.candidato_documentos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert candidato_documentos"
    ON public.candidato_documentos FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidato_documentos"
    ON public.candidato_documentos FOR UPDATE
    TO authenticated
    USING (true);

-- 2. Adicionar колонку origen_captacao se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documentos_prestadores' AND column_name = 'origem'
    ) THEN
        ALTER TABLE public.documentos_prestadores ADD COLUMN origem TEXT DEFAULT 'cadastro';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documentos_prestadores' AND column_name = 'candidato_id'
    ) THEN
        ALTER TABLE public.documentos_prestadores ADD COLUMN candidato_id UUID REFERENCES public.candidatos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Visualização de documentos orphans (sem prestador_id E sem candidato_id)
CREATE OR REPLACE VIEW public.vw_documentos_orphans AS
SELECT 
    d.id,
    d.tipo,
    d.arquivo,
    d.status,
    d.created_at,
    d.origem,
    d.prestador_id,
    d.candidato_id
FROM public.documentos_prestadores d
WHERE d.prestador_id IS NULL 
  AND d.candidato_id IS NULL
  AND d.created_at > NOW() - INTERVAL '30 days'
ORDER BY d.created_at DESC;

-- 4. Contagem de documentos por status
SELECT 
    'prestadores' AS tabela,
    COUNT(*) AS total,
    COUNT(CASE WHEN prestador_id IS NOT NULL THEN 1 END) AS vinculados,
    COUNT(CASE WHEN prestador_id IS NULL THEN 1 END) AS orphans
FROM public.documentos_prestadores
UNION ALL
SELECT 
    'candidatos' AS tabela,
    COUNT(*) AS total,
    COUNT(CASE WHEN prestador_id IS NOT NULL THEN 1 END) AS vinculados,
    0 AS orphans
FROM public.candidatos WHERE prestador_id IS NOT NULL;

-- Resultado: mostra onde estão seus documentos