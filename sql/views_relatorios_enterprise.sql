-- ============================================
-- VIEWS OTIMIZADAS PARA RELATÓRIOS ENTERPRISE
-- Conexão Express Transportes
-- ============================================

-- 1. VIEW: FATURAMENTO POR CLIENTE (Agregado)
CREATE OR REPLACE VIEW vw_relatorio_faturamento_cliente AS
SELECT
  c.id AS cliente_id,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  COALESCE(c.cnpj, '') AS cliente_cnpj,
  COUNT(DISTINCT os.id) AS quantidade_os,
  COALESCE(SUM(os.valor_cliente), 0) AS valor_faturado,
  COALESCE(SUM(CASE WHEN fr.status = 'paga' THEN fr.valor ELSE 0 END), 0) AS valor_pago,
  COALESCE(SUM(CASE WHEN fr.status IN ('a vencer', 'vencida') THEN fr.valor ELSE 0 END), 0) AS valor_pendente,
  CASE WHEN COUNT(DISTINCT os.id) > 0 
    THEN COALESCE(SUM(os.valor_cliente), 0) / COUNT(DISTINCT os.id) 
    ELSE 0 END AS ticket_medio,
  MAX(os.data_finalizacao) AS ultima_operacao,
  COALESCE(SUM(os.margem_liquida), 0) AS margem_total,
  MAX(c.created_at) AS created_at
FROM clientes c
LEFT JOIN ordens_servico os ON os.cliente_id = c.id AND os.status NOT IN ('cancelada', 'rascunho')
LEFT JOIN financeiro_receber fr ON fr.cliente_id = c.id
GROUP BY c.id, c.nome_fantasia, c.razao_social, c.cnpj;

-- 2. VIEW: FATURAMENTO POR CLIENTE (Detalhado por OS)
CREATE OR REPLACE VIEW vw_relatorio_faturamento_detalhado AS
SELECT
  os.id AS os_id,
  os.numero AS os_numero,
  os.created_at,
  os.data_finalizacao,
  c.id AS cliente_id,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  COALESCE(c.cnpj, '') AS cliente_cnpj,
  os.status,
  COALESCE(os.valor_cliente, 0) AS valor_cliente,
  COALESCE(os.custo_prestador, 0) AS custo_prestador,
  COALESCE(os.margem_liquida, 0) AS margem_liquida,
  COALESCE(os.pedagio, 0) AS pedagio,
  COALESCE(os.adicionais, 0) AS adicionais,
  COALESCE(os.descontos, 0) AS descontos,
  os.veiculo_tipo,
  os.enderecos,
  os.created_at AS data_cadastro
FROM ordens_servico os
LEFT JOIN clientes c ON c.id = os.cliente_id;

-- 3. VIEW: PAGAMENTO PRESTADORES (Resumo)
CREATE OR REPLACE VIEW vw_relatorio_pagamento_prestador AS
SELECT
  p.id AS prestador_id,
  COALESCE(p.nome_completo, p.nome_razao, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS prestador_cpf_cnpj,
  p.tipo_parceiro,
  p.status AS prestador_status,
  COALESCE(p.score_interno, p.score, 0) AS score,
  COUNT(DISTINCT os.id) AS quantidade_operacoes,
  COALESCE(SUM(os.custo_prestador), 0) AS valor_total_repasses,
  COALESCE(AVG(os.custo_prestador), 0) AS media_operacional,
  MIN(os.data_finalizacao) AS primeira_operacao,
  MAX(os.data_finalizacao) AS ultima_operacao,
  COALESCE(SUM(CASE WHEN pp.status_pagamento IN ('pendente', 'nao_pago') THEN os.custo_prestador ELSE 0 END), 0) AS valor_pendente,
  COALESCE(SUM(CASE WHEN pp.status_pagamento = 'pago' THEN os.custo_prestador ELSE 0 END), 0) AS valor_pago
FROM prestadores p
LEFT JOIN ordens_servico os ON os.prestador_id = p.id AND os.status = 'finalizada'
LEFT JOIN pagamentos_prestadores pp ON pp.prestador_id = p.id
GROUP BY p.id, p.nome_completo, p.nome_razao, p.cpf_cnpj, p.tipo_parceiro, p.status, p.score_interno, p.score;

-- 4. VIEW: PAGAMENTO PRESTADORES (Detalhado por OS)
CREATE OR REPLACE VIEW vw_relatorio_pagamento_detalhado AS
SELECT
  os.id AS os_id,
  os.numero AS os_numero,
  os.data_finalizacao,
  os.created_at,
  p.id AS prestador_id,
  COALESCE(p.nome_completo, p.nome_razao, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS prestador_cpf_cnpj,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  os.status,
  os.veiculo_tipo AS tipo_servico,
  COALESCE(os.valor_cliente, 0) AS valor_cliente,
  COALESCE(os.custo_prestador, 0) AS valor_prestador,
  COALESCE(os.pedagio, 0) AS pedagio,
  COALESCE(os.adicionais, 0) AS adicionais,
  COALESCE(os.descontos, 0) AS descontos,
  (COALESCE(os.custo_prestador, 0) + COALESCE(os.adicionais, 0) - COALESCE(os.descontos, 0)) AS valor_final_repasse,
  COALESCE(pp.status_pagamento, 'pendente') AS status_pagamento,
  os.enderecos
FROM ordens_servico os
LEFT JOIN prestadores p ON p.id = os.prestador_id
LEFT JOIN clientes c ON c.id = os.cliente_id
LEFT JOIN pagamentos_prestadores pp ON pp.os_id = os.id;

-- 5. VIEW: PRESTADORES (Análise completa)
CREATE OR REPLACE VIEW vw_relatorio_prestadores_analise AS
SELECT
  p.id AS prestador_id,
  COALESCE(p.nome_completo, p.nome_razao, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS cpf_cnpj,
  p.tipo_parceiro AS tipo_prestador,
  COALESCE(p.score_interno, p.score, 0) AS score,
  p.status AS status_operacional,
  COUNT(DISTINCT v.id) AS quantidade_veiculos,
  COALESCE(STRING_AGG(DISTINCT v.placa, ', '), '') AS veiculos_placa,
  COUNT(DISTINCT os.id) AS operacoes_realizadas,
  COALESCE(SUM(os.custo_prestador), 0) AS valor_total_recebido,
  MAX(os.data_finalizacao) AS ultima_operacao,
  COALESCE(AVG(os.custo_prestador), 0) AS media_por_operacao
FROM prestadores p
LEFT JOIN veiculos v ON v.prestador_id = p.id
LEFT JOIN ordens_servico os ON os.prestador_id = p.id AND os.status = 'finalizada'
GROUP BY p.id, p.nome_completo, p.nome_razao, p.cpf_cnpj, p.tipo_parceiro, p.score_interno, p.score, p.status;

-- ============================================
-- ÍNDICES RECOMENDADOS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_data ON ordens_servico(cliente_id, data_finalizacao);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_prestador_data ON ordens_servico(prestador_id, data_finalizacao);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_created_at ON ordens_servico(created_at);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_valor_cliente ON ordens_servico(valor_cliente);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_cliente_status ON financeiro_receber(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_prestador_status ON financeiro_pagar(prestador_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_prestador_status ON pagamentos_prestadores(prestador_id, status_pagamento);
