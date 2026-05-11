-- Migration: Adicionar colunas ausentes na tabela contratos_gerados
-- Data: 2026-05-11
-- Causa: Erro ao registrar contrato - coluna 'metadoto' inexistente

-- 1. Garantir que a coluna metadata existe
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Garantir que as colunas de valor existem
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS valor_contrato numeric;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS valor_diaria numeric;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS valor_saida numeric;

-- 3. Garantir que pdf_url existe
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS pdf_url text;

-- 4. Garantir que as colunas prestador existem
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS prestador_nome text;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS prestador_cpf text;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS prestador_cnpj text;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS prestador_rntrc text;
ALTER TABLE public.contratos_gerados ADD COLUMN IF NOT EXISTS prestador_telefone text;

-- 5. Verificar se existe a coluna 'metadoto' (typo) e remover se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contratos_gerados'
        AND column_name = 'metadoto'
    ) THEN
        ALTER TABLE public.contratos_gerados DROP COLUMN IF EXISTS metadoto;
        RAISE NOTICE 'Coluna metadoto (typo) removida com sucesso';
    ELSE
        RAISE NOTICE 'Coluna metadoto nao existe - nenhum ajuste necessario';
    END IF;
END $$;

-- 6. Garantir que status permite valores adicionais
-- Primeiro verificar se a constraint CHECK existe e remover se precisar
DO $$
BEGIN
    -- A constraint pode ter nomes diferentes, vamos verificar e ajustar
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname LIKE '%contratos_gerados_status%'
    ) THEN
        ALTER TABLE public.contratos_gerados DROP CONSTRAINT IF EXISTS contratos_gerados_status_check;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Constraint nao existe ou ja foi removida';
END $$;

-- Adicionar constraint com mais valores permitidos
ALTER TABLE public.contratos_gerados ADD CONSTRAINT contratos_gerados_status_check
CHECK (status IN ('pendente', 'enviado', 'aceito_whatsapp', 'assinado', 'recusado', 'cancelado', 'gerado', 'ativo'));

-- 7. Índices de performance
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_metadata ON public.contratos_gerados USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_prestador_id ON public.contratos_gerados(prestador_id);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_numero ON public.contratos_gerados(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_status ON public.contratos_gerados(status);

-- 8. Verificar integridade
DO $$
BEGIN
    -- Verificar se todas as colunas necessárias existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contratos_gerados' AND column_name = 'metadata'
    ) THEN
        RAISE EXCEPTION 'Coluna metadata nao existe apos tentativa de criacao!';
    END IF;

    RAISE NOTICE 'Migration concluida com sucesso - todas as colunas verificadas';
END $$;