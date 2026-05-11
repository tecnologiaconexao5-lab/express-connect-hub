ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS os_id UUID,
  ADD COLUMN IF NOT EXISTS periodo_inicio DATE,
  ADD COLUMN IF NOT EXISTS periodo_fim DATE,
  ADD COLUMN IF NOT EXISTS qtd_os INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_servicos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedagio NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reembolsos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adicionais NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descontos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adiantamentos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multas NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ajustes NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_conferencia TEXT DEFAULT 'em_aberto',
  ADD COLUMN IF NOT EXISTS status_aprovacao TEXT DEFAULT 'aguardando_aprovacao',
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS origem_lancamento TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS categoria_financeira TEXT,
  ADD COLUMN IF NOT EXISTS centro_custo TEXT,
  ADD COLUMN IF NOT EXISTS conta_contabil TEXT,
  ADD COLUMN IF NOT EXISTS competencia DATE,
  ADD COLUMN IF NOT EXISTS data_prevista_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS elegivel_lote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lote_id UUID,
  ADD COLUMN IF NOT EXISTS impacto_dre BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS impacto_fluxo_caixa BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacao TEXT;

CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_prestador_id ON pagamentos_prestadores(prestador_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_os_id ON pagamentos_prestadores(os_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_periodo_inicio ON pagamentos_prestadores(periodo_inicio);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_periodo_fim ON pagamentos_prestadores(periodo_fim);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_status_pagamento ON pagamentos_prestadores(status_pagamento);
