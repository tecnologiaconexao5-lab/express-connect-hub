-- ==========================================
-- MIGRATION: FINANCEIRO PRESTADOR AUDITORIA
-- Data: 2026-05-25
-- Objetivo: Trilha de auditoria para aprovações e alterações financeiras
-- ==========================================

CREATE TABLE IF NOT EXISTS financeiro_prestador_auditoria (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  acao text NOT NULL,
  entidade_tipo text NOT NULL,
  entidade_id text,
  prestador_id uuid REFERENCES prestadores(id),
  prestador_nome text,
  valor_anterior numeric DEFAULT 0,
  valor_novo numeric DEFAULT 0,
  detalhes jsonb DEFAULT '{}',
  criado_por text DEFAULT 'sistema',
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_auditoria_prestador ON financeiro_prestador_auditoria(prestador_id);
CREATE INDEX IF NOT EXISTS idx_fin_auditoria_acao ON financeiro_prestador_auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_fin_auditoria_entidade ON financeiro_prestador_auditoria(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_fin_auditoria_criado_em ON financeiro_prestador_auditoria(criado_em DESC);

ALTER TABLE financeiro_prestador_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY view_all_fin_auditoria ON financeiro_prestador_auditoria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY insert_fin_auditoria ON financeiro_prestador_auditoria
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE financeiro_prestador_auditoria;

COMMENT ON TABLE financeiro_prestador_auditoria IS 'Trilha de auditoria para aprovações e alterações financeiras do prestador';
COMMENT ON COLUMN financeiro_prestador_auditoria.acao IS 'Código da ação: aprovar_pagamento, reprovar_pagamento, marcar_conferido, marcar_pago, criar_pagamento, gerar_fechamento, gerar_repasse, cancelar_pagamento, atualizar_status';
COMMENT ON COLUMN financeiro_prestador_auditoria.entidade_tipo IS 'Tipo da entidade: pagamento_prestador, fechamento, repasse_escala';
COMMENT ON COLUMN financeiro_prestador_auditoria.entidade_id IS 'ID da entidade (pagamento_id, fechamento_id, etc)';
COMMENT ON COLUMN financeiro_prestador_auditoria.detalhes IS 'JSON com contexto adicional (OS, valores, etc)';
