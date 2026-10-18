-- TMS-FIN-PROG-05C.3C — ROLLBACK (restaura estado pre-reconciliacao)
-- Obs: a sequence seq_fatura_2026 nao e transacional e nao pode ser revertida.
BEGIN;
-- 1) Restaurar AR legado ao estado anterior
UPDATE public.financeiro_receber SET status='aberto', observacoes=NULL
 WHERE id='bb5c0efe-3193-49ee-a6cb-d213bee69f72';
-- 2) Restaurar a fatura ao estado rascunho (sem numero/numero_cliente/AR)
UPDATE public.faturas SET status='rascunho', numero=NULL, numero_cliente=NULL, conta_receber_id=NULL
 WHERE id='e5318b9d-120a-4a2b-a077-bebcdf8cf34c';
-- 3) Remover o AR oficial criado pela emissao (nao existia antes)
DELETE FROM public.financeiro_receber WHERE fatura_id='e5318b9d-120a-4a2b-a077-bebcdf8cf34c';
-- 4) Restaurar contador do cliente
UPDATE public.fatura_contadores_cliente SET ultimo_numero=5
 WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND cliente_id='91b80fdb-6b87-4982-a550-f863f7f15866';
COMMIT;
