-- ============================================================
-- ARQUIVO: sql/upgrade_prestadores_torre.sql
-- DESCRIÇÃO: Adicionando colunas de torre de controle
-- ============================================================

ALTER TABLE prestadores 
ADD COLUMN IF NOT EXISTS torre_ocorrencias_graves integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_sinistro integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_extravio integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_desobediencia integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_atrasos integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_elogios integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS torre_observacoes text;
