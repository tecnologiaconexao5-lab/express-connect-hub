-- Migration: Add historico JSONB to recrutamento_candidatos
-- Description: Stores operational timeline/history events for each candidate.
-- Events tracked: criado, mudou_etapa, convertido, bloqueado, aprovado, observacao_adicionada
-- Safe: IF NOT EXISTS pattern.

ALTER TABLE recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'::jsonb;

-- Note: table is already in supabase_realtime publication (added in P3 migration),
-- no need to ALTER PUBLICATION again. The new column will be broadcast automatically.
