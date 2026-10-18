-- Minimal trigger test: INSERT allocation -> check OS created
DELETE FROM alocacoes_escala WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
DELETE FROM ordens_servico WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
DELETE FROM eventos_oficiais WHERE entity_id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;

INSERT INTO alocacoes_escala (id, empresa_id, cliente_id, prestador_id, data_escala, status, tipo_veiculo, origem, destino, valor_cliente, valor_prestador)
VALUES ('aaaaaaaa-9999-9999-9999-999999999999'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE, 'pendente', 'van', 'SP', 'Campinas', 500, 400);

SELECT 'OS_EXISTS' as check_name, EXISTS(SELECT 1 FROM ordens_servico WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid) as result;
SELECT 'OS_COUNT' as check_name, (SELECT COUNT(*) FROM ordens_servico WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid) as count_val;
SELECT 'ALLOC_LINK' as check_name, (SELECT ordem_servico_id FROM alocacoes_escala WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid) as link_val;
SELECT 'EVENTOS' as check_name, (SELECT COUNT(*) FROM eventos_oficiais WHERE entity_id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid) as eventos_count;
SELECT 'RECEBER' as check_name, (SELECT COUNT(*) FROM financeiro_receber WHERE os_id = 'aaaaaaaa-9999-9999-9999-999999999999') as receber_count;
SELECT 'PAGAR' as check_name, (SELECT COUNT(*) FROM financeiro_pagar WHERE os_id = 'aaaaaaaa-9999-9999-9999-999999999999') as pagar_count;

-- Cleanup
DELETE FROM alocacoes_escala WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
DELETE FROM eventos_oficiais WHERE entity_id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
DELETE FROM ordens_servico WHERE id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
DELETE FROM financeiro_receber WHERE os_id = 'aaaaaaaa-9999-9999-9999-999999999999';
DELETE FROM financeiro_pagar WHERE os_id = 'aaaaaaaa-9999-9999-9999-999999999999';
DELETE FROM pagamentos_prestadores WHERE os_id = 'aaaaaaaa-9999-9999-9999-999999999999'::uuid;
