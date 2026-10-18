-- ===================================================================
-- CORREÇÃO: UUID safe cast + RLS prestadores/clientes + views
-- ===================================================================

-- ===================================================================
-- 1. FUNÇÃO: try_cast_uuid — safe UUID cast (retorna NULL se inválido)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.try_cast_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  IF p_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN p_text::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ===================================================================
-- 2. RECRIAR VIEWS COM UUID SEGURO
-- ===================================================================
CREATE OR REPLACE VIEW vw_relatorio_faturamento_cliente AS
SELECT
  c.id AS cliente_id,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  COALESCE(c.cnpj, '') AS cliente_cnpj,
  COUNT(DISTINCT os.id) AS quantidade_os,
  COALESCE(SUM(os.valor_cliente), 0) AS valor_faturado,
  COALESCE(SUM(CASE WHEN fr.status = 'paga' THEN fr.valor ELSE 0 END), 0) AS valor_pago,
  COALESCE(SUM(CASE WHEN fr.status IN ('a vencer', 'vencida') THEN fr.valor ELSE 0 END), 0) AS valor_pendente,
  CASE WHEN COUNT(DISTINCT os.id) > 0 
    THEN COALESCE(SUM(os.valor_cliente), 0) / COUNT(DISTINCT os.id) 
    ELSE 0 END AS ticket_medio,
  MAX(os.data) AS ultima_operacao,
  COALESCE(SUM(os.margem_liquida), 0) AS margem_total,
  MAX(c.created_at) AS created_at
FROM clientes c
LEFT JOIN ordens_servico os ON try_cast_uuid(os.cliente_id) = c.id AND os.status NOT IN ('cancelada', 'rascunho')
LEFT JOIN financeiro_receber fr ON fr.cliente_id = c.id
GROUP BY c.id, c.nome_fantasia, c.razao_social, c.cnpj;

CREATE OR REPLACE VIEW vw_relatorio_faturamento_detalhado AS
SELECT
  os.id AS os_id,
  os.numero AS os_numero,
  os.created_at,
  os.data,
  c.id AS cliente_id,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  COALESCE(c.cnpj, '') AS cliente_cnpj,
  os.status,
  COALESCE(os.valor_cliente, 0) AS valor_cliente,
  COALESCE(os.custo_prestador, 0) AS custo_prestador,
  COALESCE(os.margem_liquida, 0) AS margem_liquida,
  COALESCE(os.pedagio, 0) AS pedagio,
  COALESCE(os.adicionais::numeric, 0) AS adicionais,
  COALESCE(os.descontos, 0) AS descontos,
  os.veiculo_tipo,
  os.enderecos,
  os.created_at AS data_cadastro
FROM ordens_servico os
LEFT JOIN clientes c ON c.id = try_cast_uuid(os.cliente_id);

CREATE OR REPLACE VIEW vw_relatorio_pagamento_prestador AS
SELECT
  p.id AS prestador_id,
  COALESCE(p.nome_completo, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS prestador_cpf_cnpj,
  p.tipo_parceiro,
  p.status AS prestador_status,
  COALESCE(p.score_interno, 0) AS score,
  COUNT(DISTINCT os.id) AS quantidade_operacoes,
  COALESCE(SUM(os.custo_prestador), 0) AS valor_total_repasses,
  COALESCE(AVG(os.custo_prestador), 0) AS media_operacional,
  MIN(os.data) AS primeira_operacao,
  MAX(os.data) AS ultima_operacao,
  COALESCE(SUM(CASE WHEN pp.status_pagamento IN ('pendente', 'nao_pago') THEN os.custo_prestador ELSE 0 END), 0) AS valor_pendente,
  COALESCE(SUM(CASE WHEN pp.status_pagamento = 'pago' THEN os.custo_prestador ELSE 0 END), 0) AS valor_pago
FROM prestadores p
LEFT JOIN ordens_servico os ON try_cast_uuid(os.prestador_id) = p.id AND os.status = 'finalizada'
LEFT JOIN pagamentos_prestadores pp ON pp.prestador_id = p.id
GROUP BY p.id, p.nome_completo, p.cpf_cnpj, p.tipo_parceiro, p.status, p.score_interno;

CREATE OR REPLACE VIEW vw_relatorio_pagamento_detalhado AS
SELECT
  os.id AS os_id,
  os.numero AS os_numero,
  os.data,
  os.created_at,
  p.id AS prestador_id,
  COALESCE(p.nome_completo, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS prestador_cpf_cnpj,
  COALESCE(c.nome_fantasia, c.razao_social, 'Avulso') AS cliente_nome,
  os.status,
  os.veiculo_tipo AS tipo_servico,
  COALESCE(os.valor_cliente, 0) AS valor_cliente,
  COALESCE(os.custo_prestador, 0) AS valor_prestador,
  COALESCE(os.pedagio, 0) AS pedagio,
  COALESCE(os.adicionais::numeric, 0) AS adicionais,
  COALESCE(os.descontos, 0) AS descontos,
  (COALESCE(os.custo_prestador, 0) + COALESCE(os.adicionais::numeric, 0) - COALESCE(os.descontos, 0)) AS valor_final_repasse,
  COALESCE(pp.status_pagamento, 'pendente') AS status_pagamento,
  os.enderecos
FROM ordens_servico os
LEFT JOIN prestadores p ON p.id = try_cast_uuid(os.prestador_id)
LEFT JOIN clientes c ON c.id = try_cast_uuid(os.cliente_id)
LEFT JOIN pagamentos_prestadores pp ON pp.os_id = os.id;

CREATE OR REPLACE VIEW vw_relatorio_prestadores_analise AS
SELECT
  p.id AS prestador_id,
  COALESCE(p.nome_completo, 'Não identificado') AS prestador_nome,
  COALESCE(p.cpf_cnpj, '') AS cpf_cnpj,
  p.tipo_parceiro AS tipo_prestador,
  COALESCE(p.score_interno, 0) AS score,
  p.status AS status_operacional,
  COUNT(DISTINCT v.id) AS quantidade_veiculos,
  COALESCE(STRING_AGG(DISTINCT v.placa, ', '), '') AS veiculos_placa,
  COUNT(DISTINCT os.id) AS operacoes_realizadas,
  COALESCE(SUM(os.custo_prestador), 0) AS valor_total_recebido,
  MAX(os.data) AS ultima_operacao,
  COALESCE(AVG(os.custo_prestador), 0) AS media_por_operacao
FROM prestadores p
LEFT JOIN veiculos v ON v.prestador_vinculado = p.id
LEFT JOIN ordens_servico os ON try_cast_uuid(os.prestador_id) = p.id AND os.status = 'finalizada'
GROUP BY p.id, p.nome_completo, p.cpf_cnpj, p.tipo_parceiro, p.score_interno, p.status;

-- ===================================================================
-- 3. CORREÇÃO RLS: Restringir "App prestador can insert as candidate"
--    para evitar que qualquer authenticated insira em prestadores
-- ===================================================================
DROP POLICY IF EXISTS "App prestador can insert as candidate" ON public.prestadores;

-- ===================================================================
-- 4. CORREÇÃO RLS: Policies de clientes com role public → authenticated
-- ===================================================================
DROP POLICY IF EXISTS cliente_select_own ON public.clientes;
CREATE POLICY cliente_select_own ON public.clientes
    FOR SELECT
    TO authenticated
    USING (id = obter_cliente_id_do_usuario());

DROP POLICY IF EXISTS cliente_update_own ON public.clientes;
CREATE POLICY cliente_update_own ON public.clientes
    FOR UPDATE
    TO authenticated
    USING (id = obter_cliente_id_do_usuario())
    WITH CHECK (id = obter_cliente_id_do_usuario());

-- GRANT
GRANT EXECUTE ON FUNCTION public.try_cast_uuid TO authenticated;
