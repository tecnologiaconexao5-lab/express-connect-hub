-- FIN-SANE-02M.5G — SNAPSHOT BEFORE CESAR
-- Data: 2026-09-20
-- Hora: ~14:25 BRT

-- FP: 9f2be89f-5ece-4cc5-be29-50010b64e64e
-- BAIXA: 286c2c2d-90e4-403a-9692-8e68ccfd2a6c
-- PP: 7461daf6-438b-43b3-abde-4d30e1609574

-- ANTES DA RECONCILIAÇÃO:
--   FP.valor = 520.00, FP.status = 'pago'
--   BAIXA.valor_original = 520.00, BAIXA.valor_baixado = 520.00, BAIXA.saldo_restante = 0.00
--   PP.valor_liquido = 652.86, PP.status_pagamento = 'pendente'

-- ROLLBACK EXATO (restaurar Após reconciliação se necessário):
UPDATE financeiro_pagar
   SET valor = 520.00,
       status = 'pago',
       updated_at = '2026-08-17T18:57:32.153Z'
 WHERE id = '9f2be89f-5ece-4cc5-be29-50010b64e64e';

UPDATE financeiro_baixas
   SET valor_original = 520.00,
       saldo_restante = 0.00
 WHERE id = '286c2c2d-90e4-403a-9692-8e68ccfd2a6c';

-- PP INTACTO: NÃO ALTERAR
-- VALOR_BAIXADO INTACTO: NÃO ALTERAR (520.00)
