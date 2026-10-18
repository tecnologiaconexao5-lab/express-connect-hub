-- ============================================================
-- MISSÃO 109-A — Queries de Validação no Supabase
-- ============================================================

-- 1. Verificar OS criada
SELECT id, numero, status, cliente_id, prestador_id, tenant_id, 
       data_programada, tipo_operacao, origem, destino,
       created_at, updated_at
FROM ordens_servico
WHERE numero LIKE 'HOMOLOG-ACEITE-109A%'
ORDER BY created_at DESC;

-- 2. Verificar alocação
SELECT a.id, a.ordem_servico_id, a.prestador_id, a.status, 
       a.aceite_prestador, a.data_aceite,
       a.placa, a.tipo_veiculo, a.origem, a.destino,
       a.valor_frete, a.valor_repasse,
       a.metadata,
       p.nome_completo as prestador_nome
FROM alocacoes_escala a
LEFT JOIN prestadores p ON p.id = a.prestador_id
WHERE a.ordem_servico_id IN (
  SELECT id FROM ordens_servico 
  WHERE numero LIKE 'HOMOLOG-ACEITE-109A%'
)
ORDER BY a.created_at DESC;

-- 3. Verificar histórico de eventos
SELECT h.*
FROM historico_alocacoes_escala h
WHERE h.alocacao_id = 'ed09a11d-fab1-400d-89c6-2b04eba26377'
ORDER BY h.created_at DESC;

-- 4. Verificar duplicidade (deve retornar 1 linha)
SELECT ordem_servico_id, COUNT(*) as total
FROM alocacoes_escala
WHERE ordem_servico_id = 'addcbb9d-6e4c-4e2a-a4fc-56c0d0edada7'
GROUP BY ordem_servico_id;

-- 5. Verificar financeiro (pode ou não existir dependendo dos triggers)
SELECT * FROM financeiro_receber
WHERE os_id = 'addcbb9d-6e4c-4e2a-a4fc-56c0d0edada7';

SELECT * FROM financeiro_pagar
WHERE os_id = 'addcbb9d-6e4c-4e2a-a4fc-56c0d0edada7';

-- 6. Verificar dados do prestador (deve ter auth_user_id para login no App)
SELECT id, nome_completo, auth_user_id, liberado_app, email, 
       status, status_operacional, tipo_parceiro, metadata
FROM prestadores
WHERE id = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

-- 7. Verificar tenant
SELECT * FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001';
