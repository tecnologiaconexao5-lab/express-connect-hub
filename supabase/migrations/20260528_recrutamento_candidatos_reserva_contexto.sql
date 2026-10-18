-- Migration: Add reserva_contexto JSONB to recrutamento_candidatos
-- Description: Stores operational reservation context (cliente, operacao, regiao, observacao, prioridade)
-- Safe: IF NOT EXISTS pattern.

ALTER TABLE recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS reserva_contexto JSONB DEFAULT NULL;


