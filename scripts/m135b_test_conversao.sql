-- ============================================================
-- Testes SQL — Missão 135-B
-- Executar no SQL Editor do Supabase
-- ============================================================

-- 1. Pedido válido → converter
-- (executar com um pedido real existente, substituir o UUID)
-- SELECT converter_pedido_para_os('SUBSTITUIR_PELO_UUID_DO_PEDIDO', NULL);

-- 2. Verificar duplicidade
-- SELECT converter_pedido_para_os('SUBSTITUIR_PELO_UUID_DO_PEDIDO', NULL);
-- Deve retornar {success: true, created: false, message: "Pedido já convertido anteriormente"}

-- 3. Pedido inválido (sem cidade)
-- INSERT INTO portal_pedidos (status, numero_pedido) VALUES ('enviado', 'PED-TESTE-INVALIDO');
-- SELECT converter_pedido_para_os((SELECT id FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-INVALIDO'), NULL);
-- Deve retornar {success: false, error_code: 'CAMPOS_OBRIGATORIOS'}
-- DELETE FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-INVALIDO';

-- 4. Pedido em rascunho não deve converter
-- INSERT INTO portal_pedidos (status, numero_pedido, coleta_cidade, entrega_cidade) VALUES ('rascunho', 'PED-TESTE-RASCUNHO', 'SP', 'RJ');
-- SELECT converter_pedido_para_os((SELECT id FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-RASCUNHO'), NULL);
-- Deve retornar {success: false, error_code: 'STATUS_INVALIDO'}
-- DELETE FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-RASCUNHO';

-- 5. Pedido cancelado não deve converter
-- INSERT INTO portal_pedidos (status, numero_pedido, coleta_cidade, entrega_cidade) VALUES ('cancelado', 'PED-TESTE-CANCELADO', 'SP', 'RJ');
-- SELECT converter_pedido_para_os((SELECT id FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-CANCELADO'), NULL);
-- Deve retornar {success: false, error_code: 'STATUS_INVALIDO'}
-- DELETE FROM portal_pedidos WHERE numero_pedido = 'PED-TESTE-CANCELADO';

-- 6. Verificar vínculo bidirecional
-- SELECT pp.id AS pedido_id, pp.status AS pedido_status, pp.os_vinculada_id,
--        os.id AS os_id, os.numero AS os_numero, os.status AS os_status, os.pedido_portal_id
-- FROM portal_pedidos pp
-- LEFT JOIN ordens_servico os ON os.id = pp.os_vinculada_id
-- WHERE pp.os_vinculada_id IS NOT NULL
-- LIMIT 10;

-- 7. Verificar endereços na OS
-- SELECT oe.* FROM os_enderecos oe
-- JOIN portal_pedidos pp ON pp.os_vinculada_id = oe.os_id
-- WHERE pp.os_vinculada_id IS NOT NULL
-- LIMIT 20;

-- 8. Verificar evento no Event Bus
-- SELECT * FROM eventos_oficiais
-- WHERE event_type = 'portal.order.converted_to_service_order'
-- ORDER BY created_at DESC
-- LIMIT 5;

-- 9. Verificar que financeiro NÃO foi criado
-- SELECT fr.* FROM financeiro_receber fr
-- JOIN portal_pedidos pp ON pp.os_vinculada_id = fr.os_id
-- WHERE pp.os_vinculada_id IS NOT NULL
-- LIMIT 5;
-- (deve retornar 0 linhas pois a OS está em rascunho)
