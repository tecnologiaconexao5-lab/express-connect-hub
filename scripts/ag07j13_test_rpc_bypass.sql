-- AG-07J.13 — Script de teste manual para f_aceitar_oportunidade_rede
--
-- INSTRUÇÕES:
--   1. Executar no Supabase SQL Editor (NÃO via supabase db push)
--   2. Cada seção é independente (pode executar separadamente)
--   3. Validar resultados esperados na coluna "resultado_esperado"
--   4. NÃO executar em produção — apenas em ambiente de teste/QA
--
-- PRÉ-REQUISITOS:
--   - Pelo menos 1 prestador ativo com liberado_app=true
--   - Pelo menos 1 veículo vinculado ao prestador
--   - Pelo menos 1 OS com status pendente/agendada

-- ============================================================
-- SETUP: Identificar dados de teste
-- ============================================================

-- 1. Listar prestadores ativos com liberado_app
-- resultado_esperado: pelo menos 1 registro
SELECT id, nome_completo, status, liberado_app
FROM prestadores
WHERE status = 'ativo' AND liberado_app = true
LIMIT 5;

-- 2. Listar veículos vinculados ao primeiro prestador encontrado
-- resultado_esperado: pelo menos 1 veículo com status='disponivel'
SELECT v.id, v.placa, v.tipo_veiculo, v.capacidade_kg, v.capacidade_m3, v.tipo_carga, v.status
FROM veiculos v
WHERE v.prestador_vinculado = (
  SELECT id FROM prestadores WHERE status = 'ativo' AND liberado_app = true LIMIT 1
)
AND v.status = 'disponivel';

-- 3. Criar OS de teste (compatível com veículo do prestador)
-- resultado_esperado: OS criada com ID
INSERT INTO ordens_servico (
  status, veiculo_tipo, peso, cubagem, carga_refrigerada, veiculo_termica, carga_ajudante,
  valor_cliente, cliente_id
) VALUES (
  'pendente', 'VUC', 2000, 10, false, 'seco', false,
  1500.00, NULL
)
RETURNING id AS os_id_teste;

-- 4. Criar oportunidade vinculada à OS
-- resultado_esperado: oportunidade criada
INSERT INTO rede_oportunidades (
  os_id, status, valor_prestador, veiculo_necessario
) VALUES (
  (SELECT id FROM ordens_servico ORDER BY created_at DESC LIMIT 1),
  'publicada',
  1200.00,
  '{"tipo": "VUC", "termica": "seco", "capacidade_kg": 2000}'::jsonb
)
RETURNING id AS oportunidade_teste;

-- ============================================================
-- TESTE 1: Prestador inexistente → RECUSA
-- resultado_esperado: {"sucesso": false, "erro": "Prestador não encontrado"}
-- ============================================================
SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' LIMIT 1),
  '00000000-0000-0000-0000-000000000000'::uuid
);

-- ============================================================
-- TESTE 2: Prestador inativo → RECUSA
-- resultado_esperado: {"sucesso": false, "erro": "Prestador não está ativo"}
-- ============================================================
-- Primeiro, encontrar um prestador inativo ou criar situação de teste
SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' LIMIT 1),
  (SELECT id FROM prestadores WHERE status != 'ativo' LIMIT 1)
);

-- ============================================================
-- TESTE 3: Aceite válido (prestador ativo + veículo compatível) → ACEITA
-- resultado_esperado: {"sucesso": true, ...}
-- ============================================================
SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' LIMIT 1),
  (SELECT id FROM prestadores WHERE status = 'ativo' AND liberado_app = true LIMIT 1)
);

-- Verificar que alocação foi criada
SELECT ae.id, ae.prestador_id, ae.status, ae.tipo_veiculo, ae.ordem_servico_id
FROM alocacoes_escala ae
WHERE ae.ordem_servico_id = (
  SELECT os_id FROM rede_oportunidades WHERE status = 'aceita' ORDER BY aceite_em DESC LIMIT 1
);

-- ============================================================
-- TESTE 4: OS com carga_refrigerada=true + veículo seco → RECUSA
-- resultado_esperado: {"sucesso": false, "erro": "...capacidade térmica..."}
-- ============================================================
-- Criar OS refrigerada
INSERT INTO ordens_servico (
  status, veiculo_tipo, peso, cubagem, carga_refrigerada, veiculo_termica, carga_ajudante,
  valor_cliente
) VALUES (
  'pendente', 'VUC', 1000, 5, true, 'refrigerado', false,
  2000.00
)
RETURNING id AS os_refrigerada_id;

-- Criar oportunidade para OS refrigerada
INSERT INTO rede_oportunidades (
  os_id, status, valor_prestador, veiculo_necessario
) VALUES (
  (SELECT id FROM ordens_servico WHERE carga_refrigerada = true ORDER BY created_at DESC LIMIT 1),
  'publicada',
  1800.00,
  '{"tipo": "VUC", "termica": "refrigerado", "capacidade_kg": 1000}'::jsonb
);

-- Prestador com veículo SECO deve ser recusado
SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM prestadores WHERE status = 'ativo' AND liberado_app = true LIMIT 1)
);
-- Se veículo do prestador for seco: erro "capacidade térmica"
-- Se veículo do prestador for refrigerado: aceita

-- ============================================================
-- TESTE 5: OS com carga_ajudante=true → RECUSA
-- resultado_esperado: {"sucesso": false, "erro": "...ajudante..."}
-- ============================================================
INSERT INTO ordens_servico (
  status, veiculo_tipo, peso, cubagem, carga_refrigerada, veiculo_termica, carga_ajudante,
  valor_cliente
) VALUES (
  'pendente', 'VUC', 1000, 5, false, 'seco', true,
  1800.00
)
RETURNING id AS os_ajudante_id;

INSERT INTO rede_oportunidades (
  os_id, status, valor_prestador, veiculo_necessario
) VALUES (
  (SELECT id FROM ordens_servico WHERE carga_ajudante = true ORDER BY created_at DESC LIMIT 1),
  'publicada',
  1500.00,
  '{"tipo": "VUC", "termica": "seco", "capacidade_kg": 1000}'::jsonb
);

SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM prestadores WHERE status = 'ativo' AND liberado_app = true LIMIT 1)
);
-- Resultado esperado: erro "ajudante"

-- ============================================================
-- TESTE 6: OS com peso=5000 + veículo capacidade=3000 → RECUSA
-- resultado_esperado: {"sucesso": false, "erro": "...Capacidade insuficiente..."}
-- ============================================================
INSERT INTO ordens_servico (
  status, veiculo_tipo, peso, cubagem, carga_refrigerada, veiculo_termica, carga_ajudante,
  valor_cliente
) VALUES (
  'pendente', 'VUC', 5000, 20, false, 'seco', false,
  3000.00
)
RETURNING id AS os_pesada_id;

INSERT INTO rede_oportunidades (
  os_id, status, valor_prestador, veiculo_necessario
) VALUES (
  (SELECT id FROM ordens_servico WHERE peso = 5000 ORDER BY created_at DESC LIMIT 1),
  'publicada',
  2500.00,
  '{"tipo": "VUC", "termica": "seco", "capacidade_kg": 5000}'::jsonb
);

SELECT f_aceitar_oportunidade_rede(
  (SELECT id FROM rede_oportunidades WHERE status = 'publicada' ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM prestadores WHERE status = 'ativo' AND liberado_app = true LIMIT 1)
);
-- Se veículo do prestador tem capacidade_kg < 5000: erro "Capacidade insuficiente"
-- Se veículo do prestador tem capacidade_kg >= 5000: aceita

-- ============================================================
-- TESTE 7: Verificar que nenhuma alocação parcial foi criada nos testes de falha
-- resultado_esperado: 0 alocações com status='aceita' para OS que falharam
-- ============================================================
SELECT ae.id, ae.ordem_servico_id, ae.status, ae.tipo_veiculo
FROM alocacoes_escala ae
WHERE ae.ordem_servico_id IN (
  SELECT id FROM ordens_servico WHERE carga_ajudante = true OR carga_refrigerada = true OR peso = 5000
)
AND ae.status = 'aceita';
-- Resultado esperado: 0 registros (nenhuma alocação criada em caso de falha)

-- ============================================================
-- CLEANUP: Remover dados de teste (descomentar se necessário)
-- ============================================================
-- DELETE FROM rede_visualizacoes WHERE oportunidade_id IN (SELECT id FROM rede_oportunidades WHERE created_at > NOW() - INTERVAL '1 hour');
-- DELETE FROM rota_paradas WHERE rota_id IN (SELECT id FROM rotas WHERE created_at > NOW() - INTERVAL '1 hour');
-- DELETE FROM rotas WHERE os_id IN (SELECT id FROM ordens_servico WHERE created_at > NOW() - INTERVAL '1 hour');
-- DELETE FROM portal_notificacoes WHERE created_at > NOW() - INTERVAL '1 hour';
-- DELETE FROM os_historico WHERE created_at > NOW() - INTERVAL '1 hour';
-- DELETE FROM alocacoes_escala WHERE ordem_servico_id IN (SELECT id FROM ordens_servico WHERE created_at > NOW() - INTERVAL '1 hour');
-- DELETE FROM rede_oportunidades WHERE created_at > NOW() - INTERVAL '1 hour';
-- DELETE FROM ordens_servico WHERE created_at > NOW() - INTERVAL '1 hour';
