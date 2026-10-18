-- ============================================================
-- MIGRATION: 20260726_p1a_rotinas_editaveis
-- FASE P1A — ROTINAS EDITÁVEIS DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================
-- 1. Adiciona colunas de gestão à rotinas_ia
-- 2. Trigger de auditoria para alterações
-- 3. Índices para novas colunas
-- ============================================================

-- ==================== NOVAS COLUNAS ====================
ALTER TABLE rotinas_ia ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'normal';
ALTER TABLE rotinas_ia ADD COLUMN IF NOT EXISTS aprovacao_necessaria boolean NOT NULL DEFAULT false;
ALTER TABLE rotinas_ia ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL;
ALTER TABLE rotinas_ia ADD COLUMN IF NOT EXISTS ferramenta_id uuid REFERENCES ia_ferramentas(id) ON DELETE SET NULL;
ALTER TABLE rotinas_ia ADD COLUMN IF NOT EXISTS dias_semana integer[] DEFAULT NULL;

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_prioridade ON rotinas_ia (prioridade);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_aprovacao ON rotinas_ia (aprovacao_necessaria);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_responsavel ON rotinas_ia (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_ferramenta ON rotinas_ia (ferramenta_id);

-- ==================== FUNÇÃO DE AUDITORIA ====================
CREATE OR REPLACE FUNCTION audit_rotina_alteracao()
RETURNS trigger AS $$
BEGIN
  INSERT INTO ia_logs (robo_id, acao, entrada, saida, status, criado_em)
  VALUES (
    COALESCE(NEW.robo_id, OLD.robo_id),
    'rotina_alterada',
    jsonb_build_object(
      'rotina_id', COALESCE(NEW.id, OLD.id),
      'rotina_nome', COALESCE(NEW.nome, OLD.nome),
      'alteracoes', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(
          jsonb_strip_nulls(row_to_json(NEW)::jsonb) - jsonb_strip_nulls(row_to_json(OLD)::jsonb)
        )
        WHERE key NOT IN ('updated_at', 'ultima_execucao', 'proxima_execucao')
      )
    ),
    jsonb_build_object(
      'antes', jsonb_strip_nulls(row_to_json(OLD)::jsonb),
      'depois', jsonb_strip_nulls(row_to_json(NEW)::jsonb)
    ),
    'sucesso',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rotinas_ia_audit ON rotinas_ia;
CREATE TRIGGER trg_rotinas_ia_audit
  AFTER UPDATE ON rotinas_ia
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION audit_rotina_alteracao();

-- ==================== TRIGGER PARA NOVAS ROTINAS ====================
CREATE OR REPLACE FUNCTION log_rotina_criada()
RETURNS trigger AS $$
BEGIN
  INSERT INTO ia_logs (robo_id, acao, entrada, saida, status, criado_em)
  VALUES (
    NEW.robo_id,
    'rotina_criada',
    jsonb_build_object('rotina_id', NEW.id, 'rotina_nome', NEW.nome, 'tipo', NEW.tipo),
    row_to_json(NEW)::jsonb,
    'sucesso',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rotinas_ia_criada ON rotinas_ia;
CREATE TRIGGER trg_rotinas_ia_criada
  AFTER INSERT ON rotinas_ia
  FOR EACH ROW
  EXECUTE FUNCTION log_rotina_criada();

-- ==================== ATUALIZAR ROTINAS EXISTENTES ====================
-- Preencher ferramenta_id a partir de config.ferramenta (codigo_unico)
UPDATE rotinas_ia r
SET ferramenta_id = f.id
FROM ia_ferramentas f
WHERE r.ferramenta_id IS NULL
  AND f.codigo_unico = (r.config->>'ferramenta')
  AND r.config->>'ferramenta' IS NOT NULL;
