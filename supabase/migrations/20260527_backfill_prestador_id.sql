-- Migration: Backfill prestador_id in historical records
-- Description: After fixing OrdemServicoForm to save prestador_id (UUID),
-- old OS records have prestador_id = NULL but prestador (text name) is populated.
-- This migration safely fills prestador_id by matching nome_completo exactly.
-- Date: 2026-05-27

-- ============================================================
-- DIAGNÓSTICO PRÉ-SANEAMENTO
-- ============================================================
-- Execute these manually in Supabase SQL Editor to verify counts:

-- SELECT 
--   COUNT(*) AS total_os,
--   COUNT(*) FILTER (WHERE prestador_id IS NULL AND prestador IS NOT NULL AND prestador <> '') AS sem_prestador_id,
--   COUNT(*) FILTER (WHERE prestador_id IS NOT NULL) AS com_prestador_id
-- FROM ordens_servico;

-- SELECT os.prestador, COUNT(*) as ocorrencias
-- FROM ordens_servico os
-- WHERE os.prestador_id IS NULL AND os.prestador IS NOT NULL AND os.prestador <> ''
-- GROUP BY os.prestador
-- ORDER BY ocorrencias DESC;

-- ============================================================
-- PASSO 1: Backfill ordens_servico.prestador_id
-- ============================================================

-- 1a) Identificar prestadores com nome duplicado (AMBÍGUOS — NÃO atualizar)
CREATE TEMP TABLE IF NOT EXISTS _prestadores_ambiguos AS
SELECT trim(lower(nome_completo)) AS nome_norm
FROM public.prestadores
WHERE nome_completo IS NOT NULL AND trim(nome_completo) <> ''
GROUP BY trim(lower(nome_completo))
HAVING COUNT(*) > 1;

-- 1b) Atualizar OS com match exato por nome_completo (excluindo ambíguos)
WITH matched AS (
  SELECT os.id AS os_id, p.id AS prest_id
  FROM ordens_servico os
  JOIN public.prestadores p ON trim(lower(os.prestador)) = trim(lower(p.nome_completo))
  WHERE os.prestador_id IS NULL
    AND os.prestador IS NOT NULL
    AND trim(os.prestador) <> ''
    AND trim(lower(os.prestador)) NOT IN (SELECT nome_norm FROM _prestadores_ambiguos)
)
UPDATE ordens_servico os
SET prestador_id = matched.prest_id,
    updated_at = NOW()
FROM matched
WHERE os.id = matched.os_id;

-- 1c) Fallback: tentar match por nome_fantasia (apenas onde ainda NULL, sem ambiguidade)
CREATE TEMP TABLE IF NOT EXISTS _prestadores_ambiguos_fant AS
SELECT trim(lower(nome_fantasia)) AS nome_norm
FROM public.prestadores
WHERE nome_fantasia IS NOT NULL AND trim(nome_fantasia) <> ''
GROUP BY trim(lower(nome_fantasia))
HAVING COUNT(*) > 1;

WITH matched AS (
  SELECT os.id AS os_id, p.id AS prest_id
  FROM ordens_servico os
  JOIN public.prestadores p ON trim(lower(os.prestador)) = trim(lower(p.nome_fantasia))
  WHERE os.prestador_id IS NULL
    AND os.prestador IS NOT NULL
    AND trim(os.prestador) <> ''
    AND trim(lower(os.prestador)) NOT IN (SELECT nome_norm FROM _prestadores_ambiguos_fant)
)
UPDATE ordens_servico os
SET prestador_id = matched.prest_id,
    updated_at = NOW()
FROM matched
WHERE os.id = matched.os_id;

DROP TABLE IF EXISTS _prestadores_ambiguos;
DROP TABLE IF EXISTS _prestadores_ambiguos_fant;

-- ============================================================
-- PASSO 2: Backfill alocacoes_escala.prestador_id via OS
-- ============================================================

-- Preencher alocacoes_escala.prestador_id a partir da OS vinculada
WITH os_match AS (
  SELECT ae.id AS aloc_id, os.prestador_id AS prest_id
  FROM alocacoes_escala ae
  JOIN ordens_servico os ON os.id = ae.ordem_servico_id
  WHERE ae.prestador_id IS NULL
    AND ae.ordem_servico_id IS NOT NULL
    AND os.prestador_id IS NOT NULL
)
UPDATE alocacoes_escala ae
SET prestador_id = os_match.prest_id
FROM os_match
WHERE ae.id = os_match.aloc_id;

-- ============================================================
-- PASSO 3: Backfill pagamentos_prestadores.prestador_id via OS
-- ============================================================

-- pagamentos_prestadores_itens vinculam pagamentos a OS
WITH os_match AS (
  SELECT pp.id AS pag_id, os.prestador_id AS prest_id
  FROM pagamentos_prestadores pp
  JOIN pagamentos_prestadores_itens ppi ON ppi.pagamento_id = pp.id
  JOIN ordens_servico os ON os.id = ppi.os_id
  WHERE pp.prestador_id IS NULL
    AND os.prestador_id IS NOT NULL
)
UPDATE pagamentos_prestadores pp
SET prestador_id = os_match.prest_id,
    updated_at = NOW()
FROM os_match
WHERE pp.id = os_match.pag_id;

-- ============================================================
-- DIAGNÓSTICO PÓS-SANEAMENTO
-- ============================================================
-- Execute manually to verify:

-- SELECT 
--   COUNT(*) AS total_os,
--   COUNT(*) FILTER (WHERE prestador_id IS NULL AND prestador IS NOT NULL AND prestador <> '') AS ainda_sem_prestador_id,
--   COUNT(*) FILTER (WHERE prestador_id IS NOT NULL) AS com_prestador_id
-- FROM ordens_servico;

-- -- Ver alocacoes corrigidas:
-- SELECT COUNT(*) FILTER (WHERE prestador_id IS NULL) AS alocacoes_sem_prestador,
--   COUNT(*) FILTER (WHERE prestador_id IS NOT NULL) AS alocacoes_com_prestador
-- FROM alocacoes_escala;

-- -- Ver pagamentos corrigidos:
-- SELECT COUNT(*) FILTER (WHERE prestador_id IS NULL) AS pag_sem_prestador,
--   COUNT(*) FILTER (WHERE prestador_id IS NOT NULL) AS pag_com_prestador
-- FROM pagamentos_prestadores;
