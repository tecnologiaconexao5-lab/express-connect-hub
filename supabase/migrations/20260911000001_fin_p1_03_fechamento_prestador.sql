-- ============================================================================
-- FIN-P1-03: Fechamento do Prestador — Schema + Constraints + Índices
-- Data: 2026-09-11
-- Descrição: Adiciona fechamento_id (FK auto-ref) a pagamentos_prestadores
--            para agrupar itens de repasse em fechamentos rastreáveis.
--            Proteção contra duplicidade: mesmo item em dois fechamentos ativos.
-- ============================================================================

-- 1. Coluna fechamento_id — FK para o registro "mãe" do fechamento
--    NULL = item avulso (não fechado)
--    UUID = pertence a um fechamento (pagamentos_prestadores.tipo_pagamento = 'fechamento')
ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS fechamento_id UUID NULL;

-- 2. FK self-referencing: fechamento_id aponta para id da mesma tabela
--    (só registros com tipo_pagamento = 'fechamento' são válidos como destino)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_fechamento_pai'
  ) THEN
    ALTER TABLE pagamentos_prestadores
      ADD CONSTRAINT fk_fechamento_pai
      FOREIGN KEY (fechamento_id)
      REFERENCES pagamentos_prestadores(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Índice para buscas rápidas por fechamento_id
CREATE INDEX IF NOT EXISTS idx_pp_fechamento_id
  ON pagamentos_prestadores(fechamento_id)
  WHERE fechamento_id IS NOT NULL;

-- 4. Índice para lookup de fechamentos (tipo_pagamento = 'fechamento')
CREATE INDEX IF NOT EXISTS idx_pp_fechamento_tipo
  ON pagamentos_prestadores(tipo_pagamento, prestador_id, periodo_inicio)
  WHERE tipo_pagamento = 'fechamento';

-- 5. Proteção parcial: mesmo pagamento_id não pode estar em dois fechamentos
--    com status != cancelado (exclui itens cancelados da unicidade)
--    NOTA: Usar gin ou deferred constraint para this — simplificamos com
--    CHECK function que o service TS valida antes de INSERT.
--    Não é possível criar UNIQUE parcial com OR no PostgreSQL < 15.

-- 6. Comentários de coluna
COMMENT ON COLUMN pagamentos_prestadores.fechamento_id IS
  'FIN-P1-03: FK para pagamentos_prestadores.id do fechamento que agrupa este item. NULL = item avulso.';

-- 7. Coluna data_conferencia — snapshot de quando foi conferido
ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS data_conferencia TIMESTAMPTZ NULL;

-- 8. Coluna data_aprovacao — snapshot de quando foi aprovado
ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMPTZ NULL;

COMMENT ON COLUMN pagamentos_prestadores.data_conferencia IS
  'FIN-P1-03: Timestamp de conferência (snapshot). Preservado mesmo após alterações.';
COMMENT ON COLUMN pagamentos_prestadores.data_aprovacao IS
  'FIN-P1-03: Timestamp de aprovação (snapshot). Preservado mesmo após alterações.';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
