-- Migration: dreamflow views for motorista app
-- Created automatically by Antigravity

-- View: vw_motorista_dashboard (summary of driver status)
CREATE OR REPLACE VIEW public.vw_motorista_dashboard AS
SELECT
  m.id AS motorista_id,
  m.nome_completo AS motorista_nome,
  os.id AS escala_id,
  os.status,
  os.inicio_previsto,
  os.fim_previsto,
  v.placa,
  v.modelo,
  os.prioridade,
  os.observacoes
FROM escala_operacional os
JOIN prestadores m ON os.prestador_id = m.id
LEFT JOIN veiculos v ON os.veiculo_id = v.id
WHERE os.prestador_id = auth.uid();

-- View: vw_motorista_viagens (list of upcoming and ongoing trips)
CREATE OR REPLACE VIEW public.vw_motorista_viagens AS
SELECT
  os.id AS escala_id,
  os.data_operacao,
  os.inicio_previsto,
  os.fim_previsto,
  os.status,
  os.prioridade,
  r.id AS rota_id,
  r.nome AS rota_nome,
  v.placa,
  v.modelo
FROM escala_operacional os
LEFT JOIN rotas r ON os.rota_id = r.id
LEFT JOIN veiculos v ON os.veiculo_id = v.id
WHERE os.prestador_id = auth.uid()
ORDER BY os.data_operacao DESC;

-- View: vw_motorista_financeiro (financial overview for driver)
CREATE OR REPLACE VIEW public.vw_motorista_financeiro AS
SELECT
  f.id AS financeiro_id,
  f.valor,
  f.status,
  f.vencimento,
  os.id AS escala_id,
  os.status AS operacao_status
FROM financeiro_pagar f
LEFT JOIN ordens_servico os ON f.os_id::uuid = os.id
WHERE f.fornecedor_id = auth.uid();

-- View: vw_motorista_documentos (documents linked to driver)
CREATE OR REPLACE VIEW public.vw_motorista_documentos AS
SELECT
  d.id,
  d.tipo,
  d.url,
  d.created_at AS data_expiracao
FROM documentos_prestadores d
WHERE d.prestador_id = auth.uid();

-- View: vw_motorista_checklist (checkins made by driver)
CREATE OR REPLACE VIEW public.vw_motorista_checklist AS
SELECT
  c.id,
  c.tipo,
  c.latitude,
  c.longitude,
  c.observacao,
  c.created_at,
  c.escala_id
FROM motorista_checkins c
WHERE c.prestador_id = auth.uid();


