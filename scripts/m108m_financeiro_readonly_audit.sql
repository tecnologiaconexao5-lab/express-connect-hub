-- READ-ONLY FINANCIAL AUDIT — All SELECT queries, zero modifications
-- Generated: 2026-09-11

-- QUERY 1: financeiro_pagar FRETEBRAS
SELECT id, fornecedor, fornecedor_nome, descricao, documento, data_vencimento, vencimento, 
       valor, valor_bruto, valor_liquido, status, data_pagamento, is_teste, 
       created_at, updated_at, os_id, categoria
FROM financeiro_pagar 
WHERE fornecedor ILIKE '%FRETEBRAS%' OR fornecedor_nome ILIKE '%FRETEBRAS%'
ORDER BY data_vencimento DESC;

-- QUERY 2: financeiro_pagar vencimento 2026-09-01 to 2026-09-15
SELECT id, fornecedor, fornecedor_nome, descricao, documento, data_vencimento, 
       valor, status, is_teste, os_id
FROM financeiro_pagar 
WHERE data_vencimento BETWEEN '2026-09-01' AND '2026-09-15'
ORDER BY data_vencimento ASC;

-- QUERY 3: financeiro_pagar status breakdown
SELECT status, COUNT(*) as qtd, SUM(valor) as total_valor 
FROM financeiro_pagar 
GROUP BY status 
ORDER BY qtd DESC;

-- QUERY 4: financeiro_pagar by is_teste
SELECT is_teste, COUNT(*) as qtd, SUM(valor) as total 
FROM financeiro_pagar 
GROUP BY is_teste;

-- QUERY 5: financeiro_pagar overdue (a vencer / pendente with past vencimento)
SELECT id, fornecedor, fornecedor_nome, data_vencimento, valor, status, is_teste
FROM financeiro_pagar 
WHERE (status IN ('a vencer', 'a_vencer', 'pendente', 'aberto'))
  AND data_vencimento < '2026-09-11'
ORDER BY data_vencimento ASC;

-- QUERY 6: financeiro_receber status breakdown
SELECT status, COUNT(*) as qtd, SUM(valor) as total_valor 
FROM financeiro_receber 
GROUP BY status 
ORDER BY qtd DESC;

-- QUERY 7: financeiro_receber by is_teste
SELECT is_teste, COUNT(*) as qtd, SUM(valor) as total 
FROM financeiro_receber 
GROUP BY is_teste;

-- QUERY 8: financeiro_receber overdue (pendente / aberto with past vencimento)
SELECT id, cliente, cliente_nome, data_vencimento, valor, status, is_teste
FROM financeiro_receber 
WHERE (status IN ('pendente', 'aberto'))
  AND data_vencimento < '2026-09-11'
ORDER BY data_vencimento ASC;

-- QUERY 9: pg_stat_activity for vencimento-related queries
SELECT pid, usename, application_name, client_addr, state, query, query_start, backend_start, state_change
FROM pg_stat_activity 
WHERE query LIKE '%vencid%' OR query LIKE '%atrasad%' OR query LIKE '%status%'
ORDER BY query_start DESC;

-- QUERY 10: financeiro_baixas breakdown
SELECT titulo_tabela, COUNT(*) as qtd, SUM(valor_baixado) as total_baixado 
FROM financeiro_baixas 
WHERE estornada = false
GROUP BY titulo_tabela;
