-- Migration: Add prestador_id to recrutamento_candidatos
-- Description: Creates a persistent link from a converted candidate to its real prestador record.
-- This column already exists logically in conversaoCandidatoService (P4) but was never added to the table schema.
-- Safe: IF NOT EXISTS, ALTER TABLE IF NOT EXISTS pattern.

-- Add prestador_id column (nullable, candidates may not be converted yet)
ALTER TABLE recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS prestador_id UUID DEFAULT NULL;

-- Foreign key to recrutamento_prestadores (safe, ON DELETE SET NULL preserves candidate after prestador is removed)
ALTER TABLE recrutamento_candidatos
  ADD CONSTRAINT fk_recrutamento_candidatos_prestador
  FOREIGN KEY (prestador_id)
  REFERENCES recrutamento_prestadores(id)
  ON DELETE SET NULL
  NOT VALID;

-- Validate existing rows (skip if table is empty, avoids locking large tables)
ALTER TABLE recrutamento_candidatos
  VALIDATE CONSTRAINT fk_recrutamento_candidatos_prestador;

-- Index for quick lookups: find all candidates linked to a specific prestador
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_prestador_id
  ON recrutamento_candidatos(prestador_id);

-- Note: table is already in supabase_realtime publication (added in P3 migration),
-- no need to ALTER PUBLICATION again. The new column will be broadcast automatically.
