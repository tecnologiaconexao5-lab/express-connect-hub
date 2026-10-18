-- FIN-CONFIG-PDF-01A — Migration idempotente para alinhar configuracoes_sistema
-- ao schema definido na migration 202605200001.
-- NÃO destrutivo: preserva dados existentes.

BEGIN;

-- 1. Adicionar UNIQUE constraint em chave (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.configuracoes_sistema'::regclass
    AND contype = 'u'
  ) THEN
    ALTER TABLE public.configuracoes_sistema
      ADD CONSTRAINT configuracoes_sistema_chave_unique UNIQUE (chave);
    RAISE NOTICE 'UNIQUE constraint adicionada em chave';
  ELSE
    RAISE NOTICE 'UNIQUE constraint já existe em chave';
  END IF;
END $$;

-- 2. Garantir que chave é NOT NULL
ALTER TABLE public.configuracoes_sistema
  ALTER COLUMN chave SET NOT NULL;

-- 3. Converter valor de text para jsonb (preservando dados)
-- Só executa se o tipo atual for text
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_name = 'configuracoes_sistema'
  AND column_name = 'valor'
  AND table_schema = 'public';

  IF v_type = 'text' THEN
    -- Primeiro: converter dados existentes para jsonb válido
    -- Se já for JSON válido, mantém; senão, envolve em aspas
    UPDATE configuracoes_sistema
    SET valor = CASE
      WHEN valor ~ '^\s*[\{\[]' THEN valor::jsonb
      WHEN valor IS NULL OR valor = '' THEN '{}'::jsonb
      ELSE to_jsonb(valor)
    END
    WHERE valor IS NOT NULL;

    -- Depois: alterar o tipo da coluna
    ALTER TABLE public.configuracoes_sistema
      ALTER COLUMN valor TYPE jsonb USING valor::jsonb;
    ALTER TABLE public.configuracoes_sistema
      ALTER COLUMN valor SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.configuracoes_sistema
      ALTER COLUMN valor SET NOT NULL;

    RAISE NOTICE 'Coluna valor convertida de text para jsonb';
  ELSE
    RAISE NOTICE 'Coluna valor já é %, skipping', v_type;
  END IF;
END $$;

-- 4. Adicionar updated_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configuracoes_sistema'
    AND column_name = 'updated_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.configuracoes_sistema
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Coluna updated_at adicionada';
  ELSE
    RAISE NOTICE 'Coluna updated_at já existe';
  END IF;
END $$;

-- 5. Recriar constraint UNIQUE se a tabela foi recriada (safety)
-- Ensure the ON CONFLICT will work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.configuracoes_sistema'::regclass
    AND contype = 'u'
  ) THEN
    ALTER TABLE public.configuracoes_sistema
      ADD CONSTRAINT configuracoes_sistema_chave_unique UNIQUE (chave);
    RAISE NOTICE 'UNIQUE constraint re-adicionada (safety)';
  END IF;
END $$;

COMMIT;
