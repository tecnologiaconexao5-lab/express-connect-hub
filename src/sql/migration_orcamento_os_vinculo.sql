-- ============================================================
-- MIGRAÇÃO: Vínculo Orçamento ↔ Ordem de Serviço
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar orcamento_id na tabela ordens_servico (se não existir)
ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS orcamento_id UUID,
  ADD COLUMN IF NOT EXISTS numero_orcamento TEXT;

-- 2. Adicionar colunas de vínculo na tabela orcamentos (se não existirem)
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS os_vinculada_id UUID,
  ADD COLUMN IF NOT EXISTS os_vinculada_numero TEXT;

-- 3. Índice para busca rápida por orcamento_id na tabela ordens_servico
CREATE INDEX IF NOT EXISTS idx_ordens_servico_orcamento_id
  ON ordens_servico(orcamento_id);

-- 4. Índice para busca rápida por os_vinculada_id na tabela orcamentos
CREATE INDEX IF NOT EXISTS idx_orcamentos_os_vinculada_id
  ON orcamentos(os_vinculada_id);

-- ============================================================
-- VERIFICAÇÃO: Confirmar que as colunas foram criadas
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('orcamentos', 'ordens_servico')
  AND column_name IN (
    'orcamento_id', 'numero_orcamento',
    'os_vinculada_id', 'os_vinculada_numero'
  )
ORDER BY table_name, column_name;
