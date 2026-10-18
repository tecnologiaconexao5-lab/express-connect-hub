-- TMS-FIN-PROG-04C.2 — ROLLBACK do saneamento (executar manualmente se necessario)
-- Observacao: a sequence seq_fatura_2026 NAO e transacional e nao pode ser revertida.
BEGIN;

-- 1) Desvincular os ARs legados das faturas 38 e 41 (NAO altera valor/status/data_pagamento/baixa)
UPDATE public.financeiro_receber SET fatura_id = NULL
 WHERE id = '0eab9f84-3ff0-4a59-be5a-11fff05fddcd' AND fatura_id = 'a22334a3-fdee-4fd2-8eb5-71321e981162';
UPDATE public.financeiro_receber SET fatura_id = NULL
 WHERE id = 'bbbaa2dc-a210-49df-abb6-d45b06e92288' AND fatura_id = 'ebbc46d2-41ff-4412-aa4c-a5b5e81d1411';

-- 2) Remover os ARs CRIADOS para 39, 40. e 42 (nao existiam antes)
DELETE FROM public.financeiro_receber
 WHERE fatura_id IN ('3cff86c2-1985-4492-90bf-8027d1cf20d7', 'ed616465-4479-41e2-948f-969f0cadd3f7', '7220ed09-50d8-41a1-b3ce-a315e416bcde');

-- 3) Restaurar as 5 faturas ao estado pre-saneamento (numero/numero_cliente/conta_receber_id NULL)
UPDATE public.faturas
   SET numero = NULL, numero_cliente = NULL, conta_receber_id = NULL
 WHERE id IN ('a22334a3-fdee-4fd2-8eb5-71321e981162', '3cff86c2-1985-4492-90bf-8027d1cf20d7', 'ed616465-4479-41e2-948f-969f0cadd3f7', 'ebbc46d2-41ff-4412-aa4c-a5b5e81d1411', '7220ed09-50d8-41a1-b3ce-a315e416bcde');

-- 4) Remover o contador do cliente 91b80fdb (nao existia antes)
DELETE FROM public.fatura_contadores_cliente
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND cliente_id = '91b80fdb-6b87-4982-a550-f863f7f15866';
COMMIT;
