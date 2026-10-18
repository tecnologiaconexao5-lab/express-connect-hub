-- LIMPEZA DOS DADOS DE HOMOLOGAÇÃO 135-B
-- ATENÇÃO: Executar somente após screenshots e evidências

BEGIN;
-- Remover evento
DELETE FROM eventos_oficiais WHERE entity_id = '32a26fe6-c7d7-4090-8580-ffd98f0e6e89' AND event_type = 'portal.order.converted_to_service_order';
-- Remover OS
DELETE FROM ordens_servico WHERE id = '32a26fe6-c7d7-4090-8580-ffd98f0e6e89';
-- Remover pedido
DELETE FROM portal_pedidos WHERE id = '5adfa847-b5ee-49ac-b2ba-c4aefd94c86c';
COMMIT;
