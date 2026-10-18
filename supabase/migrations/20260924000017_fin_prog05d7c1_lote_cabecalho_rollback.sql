-- ============================================================================
-- TMS-FIN-PROG-05D.7C.1 — ROLLBACK
-- Remove FK, itens e cabecalho. Reaplicar 20260924000014 para restaurar a RPC
-- (05D.7B.1) caso necessario.
-- ============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.f_gerar_lote_pagamentos(uuid[]);

ALTER TABLE public.pagamentos_prestadores DROP CONSTRAINT IF EXISTS fk_pp_lote;

DROP TABLE IF EXISTS public.lotes_pagamento_itens;
DROP TABLE IF EXISTS public.lotes_pagamento;

COMMIT;
