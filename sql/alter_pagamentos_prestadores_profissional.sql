-- TAREFA 8: Atualização da tabela pagamentos_prestadores para o padrão profissional

ALTER TABLE pagamentos_prestadores
  -- Cliente e OS vinculados
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id),
  ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES ordens_servico(id),
  ADD COLUMN IF NOT EXISTS os_numero VARCHAR(50),
  
  -- Classificação do lançamento
  ADD COLUMN IF NOT EXISTS tipo_lancamento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS natureza VARCHAR(20) DEFAULT 'credito', -- credito ou debito
  
  -- Valores detalhados
  ADD COLUMN IF NOT EXISTS valor NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pedagio NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_estacionamento NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_combustivel NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_adicionais NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_multas NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_ajustes NUMERIC(10, 2) DEFAULT 0,
  
  -- Datas
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_prevista_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  
  -- Pagamento e Financeiro
  ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(50),
  ADD COLUMN IF NOT EXISTS conta_pagamento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS arquivo VARCHAR(255),
  
  -- Status Profissionais
  ADD COLUMN IF NOT EXISTS status_conferencia VARCHAR(50) DEFAULT 'em_aberto', -- em_aberto, conferido, divergente, bloqueado
  ADD COLUMN IF NOT EXISTS status_pagamento VARCHAR(50) DEFAULT 'pendente', -- pendente, agendado, em_lote, pago, cancelado
  
  -- Lote e CNAB
  ADD COLUMN IF NOT EXISTS elegivel_lote BOOLEAN DEFAULT false,
  
  -- Integração DRE e Fluxo
  ADD COLUMN IF NOT EXISTS categoria_financeira VARCHAR(100),
  ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS conta_contabil VARCHAR(100),
  ADD COLUMN IF NOT EXISTS origem_lancamento VARCHAR(50) DEFAULT 'manual', -- manual, os, fechamento, lote
  ADD COLUMN IF NOT EXISTS impacto_dre BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS impacto_fluxo_caixa BOOLEAN DEFAULT true;
