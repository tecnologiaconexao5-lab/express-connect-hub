-- ============================================================
-- MIGRATION: 20260702_f26_rotinas_ia_hardening
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Correções, índices compostos e função de recuperação
--            para o Motor de Rotinas (F26.3)
-- ============================================================

-- 1. ÍNDICE COMPOSTO para a query de rotinas pendentes
--    Usado por buscarRotinasPendentes(): WHERE ativo=true AND status IN (...) AND proxima_execucao <= now()
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_pendentes
  ON rotinas_ia (ativo, status, proxima_execucao)
  WHERE ativo = true AND status IN ('pending', 'success', 'error');

-- 2. FUNÇÃO PARA RECUPERAR EXECUÇÕES TRAVADAS
--    Rotinas em status "running" há mais de 5 minutos são destravadas
CREATE OR REPLACE FUNCTION recuperar_rotinas_travadas()
RETURNS TABLE(rotina_id uuid, execucao_id uuid, minutos_travado numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH travadas AS (
    SELECT
      re.rotina_id,
      re.id AS execucao_id,
      EXTRACT(EPOCH FROM (now() - re.started_at)) / 60 AS minutos
    FROM rotinas_execucoes_ia re
    WHERE re.status = 'running'
      AND re.started_at < now() - interval '5 minutes'
  )
  UPDATE rotinas_execucoes_ia re
  SET
    status = 'error',
    erro = 'Timeout automático: execução travada por mais de 5 minutos',
    logs = COALESCE(re.logs, '') || E'\n[' || now()::text || '] TIMEOUT: execução travada',
    finished_at = now()
  FROM travadas t
  WHERE re.id = t.execucao_id;

  RETURN QUERY
  UPDATE rotinas_ia r
  SET status = 'error'::status_rotina_ia
  FROM travadas t
  WHERE r.id = t.rotina_id
    AND r.status = 'running'::status_rotina_ia;

  RETURN QUERY
  SELECT t.rotina_id, t.execucao_id, t.minutos
  FROM travadas t;
END;
$$;

-- 3. GARANTIR QUE O TRIGGER DE updated_at FUNCIONA (já existe, só recria se necessário)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rotinas_ia_updated_at') THEN
    CREATE TRIGGER trg_rotinas_ia_updated_at
      BEFORE UPDATE ON rotinas_ia
      FOR EACH ROW EXECUTE FUNCTION update_rotinas_ia_updated_at();
  END IF;
END $$;
