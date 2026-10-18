-- ============================================================
-- MIGRATION: 20260704_f27_1_diretor_virtual_live
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Diretor Virtual IA — Live Engine de Decisões Contínuas (F27.1)
-- ============================================================

-- ==================== TABELA: diretor_virtual_eventos_ia ====================
CREATE TABLE IF NOT EXISTS diretor_virtual_eventos_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('analise', 'decisao', 'acao', 'erro')),
  robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  rotina_id uuid REFERENCES rotinas_ia(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON diretor_virtual_eventos_ia (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_robo ON diretor_virtual_eventos_ia (robo_id);
CREATE INDEX IF NOT EXISTS idx_eventos_rotina ON diretor_virtual_eventos_ia (rotina_id);
CREATE INDEX IF NOT EXISTS idx_eventos_created ON diretor_virtual_eventos_ia (created_at DESC);

-- ==================== RLS POLICIES ====================
ALTER TABLE diretor_virtual_eventos_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_eventos_select' AND tablename = 'diretor_virtual_eventos_ia') THEN
    CREATE POLICY dv_eventos_select ON diretor_virtual_eventos_ia FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dv_eventos_insert' AND tablename = 'diretor_virtual_eventos_ia') THEN
    CREATE POLICY dv_eventos_insert ON diretor_virtual_eventos_ia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
