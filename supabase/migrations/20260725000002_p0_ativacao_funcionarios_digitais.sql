-- ============================================================
-- MIGRATION: 20260725_p0_ativacao_funcionarios_digitais
-- FASE P0 — ATIVAÇÃO DOS FUNCIONÁRIOS DIGITAIS
-- ============================================================
-- 1. Cria novas ferramentas operacionais (27)
-- 2. Vincula ferramentas aos 8 robôs (vinculações)
-- 3. Adiciona schemas de parâmetros
-- 4. Cria rotinas operacionais agendadas
-- ============================================================

-- ==================== PARTE 1: NOVAS FERRAMENTAS ====================
INSERT INTO ia_ferramentas (codigo_unico, nome, descricao, categoria, precisa_aprovacao, risco_operacional, limite_execucoes_dia) VALUES
  -- Comercial IA
  ('COM_CONSULTAR_LEADS', 'Consultar Leads', 'Consulta e qualificação de leads no CRM', 'COMERCIAL', false, 'baixo', 200),
  ('COM_REGISTRAR_FOLLOWUP', 'Registrar Follow-up', 'Registro de follow-up com lead ou cliente', 'COMERCIAL', true, 'medio', 100),
  ('COM_CRIAR_TAREFA', 'Criar Tarefa', 'Criação de tarefa operacional no sistema', 'OPERACIONAL', true, 'medio', 50),
  -- Operacional IA
  ('COM_CONSULTAR_OS', 'Consultar OS', 'Consulta de ordens de serviço', 'OPERACIONAL', false, 'baixo', 200),
  ('COM_CRIAR_ESCALA', 'Criar Escala', 'Criação de escala de prestadores', 'OPERACIONAL', true, 'alto', 30),
  ('COM_ATUALIZAR_STATUS', 'Atualizar Status', 'Atualização de status de OS e entregas', 'OPERACIONAL', true, 'medio', 100),
  ('COM_REGISTRAR_OCORRENCIA', 'Registrar Ocorrência', 'Registro de ocorrência operacional', 'OPERACIONAL', true, 'medio', 50),
  ('COM_GERAR_ALERTA', 'Gerar Alerta', 'Geração de alerta operacional', 'OPERACIONAL', true, 'medio', 100),
  -- Recrutamento IA
  ('COM_CONSULTAR_CANDIDATOS', 'Consultar Candidatos', 'Consulta de candidatos em processos seletivos', 'RECRUTAMENTO', false, 'baixo', 200),
  ('COM_ANALISAR_DOCUMENTOS', 'Analisar Documentos', 'Análise de documentos de candidatos', 'RECRUTAMENTO', true, 'medio', 50),
  ('COM_REGISTRAR_AVALIACAO', 'Registrar Avaliação', 'Registro de avaliação de candidato', 'RECRUTAMENTO', true, 'medio', 50),
  ('COM_ENVIAR_CONVITE', 'Enviar Convite', 'Envio de convite para entrevista ou processo', 'RECRUTAMENTO', true, 'medio', 30),
  -- Financeiro IA
  ('COM_CONSULTAR_FINANCEIRO', 'Consultar Financeiro', 'Consulta de dados financeiros de cliente', 'FINANCEIRO', false, 'baixo', 200),
  ('COM_REGISTRAR_PAGAMENTO', 'Registrar Pagamento', 'Registro de pagamento recebido', 'FINANCEIRO', true, 'alto', 50),
  -- Fiscal IA
  ('COM_CONSULTAR_DOCUMENTOS_FISCAIS', 'Consultar Documentos Fiscais', 'Consulta de documentos fiscais emitidos', 'DOCUMENTOS', false, 'baixo', 200),
  ('COM_VALIDAR_XML', 'Validar XML', 'Validação de XML fiscal', 'DOCUMENTOS', true, 'medio', 100),
  ('COM_CONFERIR_CTE', 'Conferir CT-e', 'Conferência de Conhecimento de Transporte eletrônico', 'DOCUMENTOS', true, 'alto', 50),
  ('COM_CONFERIR_NFSE', 'Conferir NFS-e', 'Conferência de Nota Fiscal de Serviço eletrônica', 'DOCUMENTOS', true, 'alto', 50),
  -- Cliente IA
  ('COM_CONSULTAR_PEDIDO', 'Consultar Pedido', 'Consulta de pedido do cliente', 'COMERCIAL', false, 'baixo', 200),
  ('COM_CONSULTAR_STATUS', 'Consultar Status', 'Consulta de status de OS para cliente', 'COMERCIAL', false, 'baixo', 200),
  ('COM_CONSULTAR_HISTORICO', 'Consultar Histórico', 'Consulta de histórico de serviços do cliente', 'COMERCIAL', false, 'baixo', 200),
  -- Prestador IA
  ('COM_CONSULTAR_ESCALA', 'Consultar Escala', 'Consulta de escala do prestador', 'OPERACIONAL', false, 'baixo', 200),
  ('COM_CONSULTAR_PAGAMENTOS', 'Consultar Pagamentos', 'Consulta de pagamentos do prestador', 'FINANCEIRO', false, 'baixo', 200),
  ('COM_CONSULTAR_OCORRENCIAS', 'Consultar Ocorrências', 'Consulta de ocorrências do prestador', 'OPERACIONAL', false, 'baixo', 200),
  -- Monitoramento IA
  ('COM_CONSULTAR_ALERTAS', 'Consultar Alertas', 'Consulta de alertas e notificações do sistema', 'OPERACIONAL', false, 'baixo', 200),
  ('COM_MONITORAR_PROCESSOS', 'Monitorar Processos', 'Monitoramento de processos operacionais em tempo real', 'OPERACIONAL', true, 'medio', 100),
  ('COM_GERAR_RELATORIO', 'Gerar Relatório', 'Geração de relatório gerencial', 'DOCUMENTOS', true, 'baixo', 30)
ON CONFLICT (codigo_unico) DO NOTHING;

-- ==================== PARTE 2: PARÂMETROS DAS NOVAS FERRAMENTAS ====================
UPDATE ia_ferramentas SET parametros = '{
  "filtro": {"tipo": "texto", "obrigatorio": false, "descricao": "Filtro para consulta"},
  "limite": {"tipo": "numero", "obrigatorio": false, "descricao": "Limite de registros"}
}' WHERE codigo_unico IN ('COM_CONSULTAR_LEADS', 'COM_CONSULTAR_CANDIDATOS', 'COM_CONSULTAR_OS', 'COM_CONSULTAR_FINANCEIRO', 'COM_CONSULTAR_DOCUMENTOS_FISCAIS', 'COM_CONSULTAR_PEDIDO', 'COM_CONSULTAR_STATUS', 'COM_CONSULTAR_HISTORICO', 'COM_CONSULTAR_ESCALA', 'COM_CONSULTAR_PAGAMENTOS', 'COM_CONSULTAR_OCORRENCIAS', 'COM_CONSULTAR_ALERTAS');

UPDATE ia_ferramentas SET parametros = '{
  "lead_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do lead"},
  "tipo": {"tipo": "texto", "obrigatorio": false, "descricao": "Tipo de follow-up"},
  "descricao": {"tipo": "texto", "obrigatorio": true, "descricao": "Descricao do follow-up"}
}' WHERE codigo_unico = 'COM_REGISTRAR_FOLLOWUP';

UPDATE ia_ferramentas SET parametros = '{
  "titulo": {"tipo": "texto", "obrigatorio": true, "descricao": "Titulo da tarefa"},
  "descricao": {"tipo": "texto", "obrigatorio": false, "descricao": "Descricao detalhada"},
  "responsavel": {"tipo": "texto", "obrigatorio": false, "descricao": "Responsavel pela tarefa"},
  "prioridade": {"tipo": "texto", "obrigatorio": false, "descricao": "Prioridade: baixa, normal, alta, critica"}
}' WHERE codigo_unico = 'COM_CRIAR_TAREFA';

UPDATE ia_ferramentas SET parametros = '{
  "prestadores": {"tipo": "json", "obrigatorio": true, "descricao": "Lista de prestadores"},
  "data_inicio": {"tipo": "data", "obrigatorio": true, "descricao": "Data de inicio da escala"},
  "data_fim": {"tipo": "data", "obrigatorio": true, "descricao": "Data de fim da escala"}
}' WHERE codigo_unico = 'COM_CRIAR_ESCALA';

UPDATE ia_ferramentas SET parametros = '{
  "os_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID da OS"},
  "status": {"tipo": "texto", "obrigatorio": true, "descricao": "Novo status"}
}' WHERE codigo_unico = 'COM_ATUALIZAR_STATUS';

UPDATE ia_ferramentas SET parametros = '{
  "os_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID da OS"},
  "tipo": {"tipo": "texto", "obrigatorio": true, "descricao": "Tipo de ocorrencia"},
  "descricao": {"tipo": "texto", "obrigatorio": true, "descricao": "Descricao da ocorrencia"}
}' WHERE codigo_unico = 'COM_REGISTRAR_OCORRENCIA';

UPDATE ia_ferramentas SET parametros = '{
  "tipo": {"tipo": "texto", "obrigatorio": true, "descricao": "Tipo de alerta"},
  "mensagem": {"tipo": "texto", "obrigatorio": true, "descricao": "Mensagem do alerta"},
  "gravidade": {"tipo": "texto", "obrigatorio": false, "descricao": "Gravidade: baixo, medio, alto, critico"}
}' WHERE codigo_unico IN ('COM_GERAR_ALERTA', 'COM_CONSULTAR_ALERTAS');

UPDATE ia_ferramentas SET parametros = '{
  "candidato_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do candidato"},
  "documentos": {"tipo": "json", "obrigatorio": true, "descricao": "Documentos para analise"}
}' WHERE codigo_unico = 'COM_ANALISAR_DOCUMENTOS';

UPDATE ia_ferramentas SET parametros = '{
  "candidato_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do candidato"},
  "nota": {"tipo": "numero", "obrigatorio": true, "descricao": "Nota da avaliacao"},
  "comentario": {"tipo": "texto", "obrigatorio": false, "descricao": "Comentarios"}
}' WHERE codigo_unico = 'COM_REGISTRAR_AVALIACAO';

UPDATE ia_ferramentas SET parametros = '{
  "candidato_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do candidato"},
  "tipo_convite": {"tipo": "texto", "obrigatorio": true, "descricao": "Tipo: entrevista, processo, documento"},
  "mensagem": {"tipo": "texto", "obrigatorio": false, "descricao": "Mensagem personalizada"}
}' WHERE codigo_unico = 'COM_ENVIAR_CONVITE';

UPDATE ia_ferramentas SET parametros = '{
  "cliente_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do cliente"},
  "valor": {"tipo": "numero", "obrigatorio": true, "descricao": "Valor do pagamento"},
  "data": {"tipo": "data", "obrigatorio": false, "descricao": "Data do pagamento"}
}' WHERE codigo_unico = 'COM_REGISTRAR_PAGAMENTO';

UPDATE ia_ferramentas SET parametros = '{
  "xml_content": {"tipo": "texto", "obrigatorio": true, "descricao": "Conteudo do XML"}
}' WHERE codigo_unico = 'COM_VALIDAR_XML';

UPDATE ia_ferramentas SET parametros = '{
  "documento_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do CT-e"}
}' WHERE codigo_unico = 'COM_CONFERIR_CTE';

UPDATE ia_ferramentas SET parametros = '{
  "documento_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID da NFS-e"}
}' WHERE codigo_unico = 'COM_CONFERIR_NFSE';

UPDATE ia_ferramentas SET parametros = '{
  "processo_id": {"tipo": "uuid", "obrigatorio": false, "descricao": "ID do processo"},
  "tipo": {"tipo": "texto", "obrigatorio": false, "descricao": "Tipo de monitoramento"}
}' WHERE codigo_unico = 'COM_MONITORAR_PROCESSOS';

UPDATE ia_ferramentas SET parametros = '{
  "tipo": {"tipo": "texto", "obrigatorio": true, "descricao": "Tipo de relatorio"},
  "periodo_inicio": {"tipo": "data", "obrigatorio": false, "descricao": "Inicio do periodo"},
  "periodo_fim": {"tipo": "data", "obrigatorio": false, "descricao": "Fim do periodo"}
}' WHERE codigo_unico = 'COM_GERAR_RELATORIO';

-- Timeouts personalizados
UPDATE ia_ferramentas SET timeout_segundos = 30 WHERE codigo_unico IN (
  'COM_CONSULTAR_LEADS', 'COM_CONSULTAR_OS', 'COM_CONSULTAR_CANDIDATOS',
  'COM_CONSULTAR_FINANCEIRO', 'COM_CONSULTAR_DOCUMENTOS_FISCAIS',
  'COM_CONSULTAR_PEDIDO', 'COM_CONSULTAR_STATUS', 'COM_CONSULTAR_HISTORICO',
  'COM_CONSULTAR_ESCALA', 'COM_CONSULTAR_PAGAMENTOS', 'COM_CONSULTAR_OCORRENCIAS',
  'COM_CONSULTAR_ALERTAS', 'COM_VALIDAR_XML'
);

-- ==================== PARTE 3: VINCULAÇÕES ROBÔ × FERRAMENTA ====================

-- 3.1 COMERCIAL IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_LEADS', 'CONSULTA'::nivel_autonomia_ferramenta, 200),
  ('COM_GERAR_PROPOSTA', 'EXECUTAR_COM_APROVACAO', 30),
  ('COM_REGISTRAR_FOLLOWUP', 'EXECUTAR_COM_APROVACAO', 100),
  ('COM_ENVIAR_EMAIL', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_CRIAR_TAREFA', 'EXECUTAR_COM_APROVACAO', 50)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Comercial IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.2 OPERACIONAL IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_OS', 'CONSULTA', 200),
  ('COM_CRIAR_ESCALA', 'EXECUTAR_COM_APROVACAO', 30),
  ('COM_ATUALIZAR_STATUS', 'EXECUTAR_COM_APROVACAO', 100),
  ('COM_REGISTRAR_OCORRENCIA', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_GERAR_ALERTA', 'EXECUTAR_COM_APROVACAO', 100)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Operacional IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.3 RECRUTAMENTO IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_CANDIDATOS', 'CONSULTA', 200),
  ('COM_ANALISAR_DOCUMENTOS', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_REGISTRAR_AVALIACAO', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_ENVIAR_CONVITE', 'EXECUTAR_COM_APROVACAO', 30),
  ('COM_ENVIAR_EMAIL', 'EXECUTAR_COM_APROVACAO', 50)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Recrutamento IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.4 FINANCEIRO IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_FINANCEIRO', 'CONSULTA', 200),
  ('COM_REALIZAR_COBRANCA', 'EXECUTAR_COM_APROVACAO', 30),
  ('COM_ENVIAR_BOLETO', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_REGISTRAR_PAGAMENTO', 'EXECUTAR_COM_APROVACAO', 50)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Financeiro IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.5 FISCAL IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_DOCUMENTOS_FISCAIS', 'CONSULTA', 200),
  ('COM_VALIDAR_XML', 'EXECUTAR_COM_APROVACAO', 100),
  ('COM_CONFERIR_CTE', 'EXECUTAR_COM_APROVACAO', 50),
  ('COM_CONFERIR_NFSE', 'EXECUTAR_COM_APROVACAO', 50)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Fiscal IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.6 CLIENTE IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_PEDIDO', 'EXECUTAR_AUTONOMO', 200),
  ('COM_CONSULTAR_STATUS', 'EXECUTAR_AUTONOMO', 200),
  ('COM_CONSULTAR_HISTORICO', 'EXECUTAR_AUTONOMO', 200)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Cliente IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.7 PRESTADOR IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_ESCALA', 'EXECUTAR_AUTONOMO', 200),
  ('COM_CONSULTAR_PAGAMENTOS', 'EXECUTAR_AUTONOMO', 200),
  ('COM_CONSULTAR_OCORRENCIAS', 'EXECUTAR_AUTONOMO', 200)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Prestador IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- 3.8 MONITORAMENTO IA
INSERT INTO ia_robo_ferramentas (robo_id, ferramenta_id, nivel_autonomia, limite_diario)
SELECT r.id, f.id, v.nivel, v.limite
FROM automacoes_robos r, ia_ferramentas f, (VALUES
  ('COM_CONSULTAR_ALERTAS', 'EXECUTAR_AUTONOMO', 200),
  ('COM_MONITORAR_PROCESSOS', 'EXECUTAR_AUTONOMO', 100),
  ('COM_GERAR_RELATORIO', 'EXECUTAR_COM_APROVACAO', 30)
) AS v(uni, nivel, limite)
WHERE r.nome = 'Monitoramento IA' AND f.codigo_unico = v.uni
ON CONFLICT (robo_id, ferramenta_id) DO NOTHING;

-- ==================== PARTE 4: ROTINAS OPERACIONAIS AGENDADAS ====================
DO $$
DECLARE
  v_comercial_id UUID;
  v_operacional_id UUID;
  v_recrutamento_id UUID;
  v_financeiro_id UUID;
  v_fiscal_id UUID;
  v_monitoramento_id UUID;
  v_cliente_id UUID;
  v_prestador_id UUID;
  v_rotina_id UUID;
BEGIN
  SELECT id INTO v_comercial_id FROM automacoes_robos WHERE nome = 'Comercial IA';
  SELECT id INTO v_operacional_id FROM automacoes_robos WHERE nome = 'Operacional IA';
  SELECT id INTO v_recrutamento_id FROM automacoes_robos WHERE nome = 'Recrutamento IA';
  SELECT id INTO v_financeiro_id FROM automacoes_robos WHERE nome = 'Financeiro IA';
  SELECT id INTO v_fiscal_id FROM automacoes_robos WHERE nome = 'Fiscal IA';
  SELECT id INTO v_monitoramento_id FROM automacoes_robos WHERE nome = 'Monitoramento IA';
  SELECT id INTO v_cliente_id FROM automacoes_robos WHERE nome = 'Cliente IA';
  SELECT id INTO v_prestador_id FROM automacoes_robos WHERE nome = 'Prestador IA';

  -- RECRUTAMENTO IA: 08:00 verificar candidatos
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_recrutamento_id, 'Verificar Candidatos', 'Verificar novos candidatos e triar automaticamente', 'scheduled', '0 8 * * 1-5', true, 'pending', '{"ferramenta": "COM_CONSULTAR_CANDIDATOS", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- RECRUTAMENTO IA: 09:00 analisar documentos
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_recrutamento_id, 'Analisar Documentos', 'Analisar documentos de candidatos pendentes', 'scheduled', '0 9 * * 1-5', true, 'pending', '{"ferramenta": "COM_ANALISAR_DOCUMENTOS", "prioridade": "normal"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- RECRUTAMENTO IA: 17:00 gerar relatório
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_recrutamento_id, 'Gerar Relatório Recrutamento', 'Gerar relatório diário de recrutamento', 'scheduled', '0 17 * * 1-5', true, 'pending', '{"ferramenta": "COM_GERAR_RELATORIO", "tipo": "recrutamento"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- COMERCIAL IA: 08:00 verificar leads
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_comercial_id, 'Verificar Leads', 'Verificar novos leads e qualificar', 'scheduled', '0 8 * * 1-5', true, 'pending', '{"ferramenta": "COM_CONSULTAR_LEADS", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- COMERCIAL IA: 11:00 follow-up
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_comercial_id, 'Follow-up Leads', 'Realizar follow-up em leads pendentes', 'scheduled', '0 11 * * 1-5', true, 'pending', '{"ferramenta": "COM_REGISTRAR_FOLLOWUP", "prioridade": "normal"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- COMERCIAL IA: 17:00 relatório
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_comercial_id, 'Gerar Relatório Comercial', 'Gerar relatório diário comercial', 'scheduled', '0 17 * * 1-5', true, 'pending', '{"ferramenta": "COM_GERAR_RELATORIO", "tipo": "comercial"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- FINANCEIRO IA: 08:00 cobranças
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_financeiro_id, 'Processar Cobranças', 'Processar cobranças pendentes do dia', 'scheduled', '0 8 * * 1-5', true, 'pending', '{"ferramenta": "COM_REALIZAR_COBRANCA", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- FINANCEIRO IA: 15:00 inadimplência
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_financeiro_id, 'Consultar Inadimplência', 'Consultar financeiro e identificar inadimplentes', 'scheduled', '0 15 * * 1-5', true, 'pending', '{"ferramenta": "COM_CONSULTAR_FINANCEIRO", "prioridade": "normal"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- FINANCEIRO IA: 17:00 relatório
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_financeiro_id, 'Gerar Relatório Financeiro', 'Gerar relatório financeiro diário', 'scheduled', '0 17 * * 1-5', true, 'pending', '{"ferramenta": "COM_GERAR_RELATORIO", "tipo": "financeiro"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- OPERACIONAL IA: 06:00 verificar OS do dia
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_operacional_id, 'Verificar OS do Dia', 'Consultar ordens de serviço do dia', 'scheduled', '0 6 * * 1-6', true, 'pending', '{"ferramenta": "COM_CONSULTAR_OS", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- OPERACIONAL IA: 18:00 consolidar ocorrências
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_operacional_id, 'Consolidar Ocorrências', 'Registrar e consolidar ocorrências do dia', 'scheduled', '0 18 * * 1-6', true, 'pending', '{"ferramenta": "COM_REGISTRAR_OCORRENCIA", "prioridade": "normal"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- MONITORAMENTO IA: a cada 30 minutos em horário comercial
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, interval_seconds, ativo, status, config, proxima_execucao)
  VALUES (v_monitoramento_id, 'Monitorar Processos', 'Monitorar processos operacionais a cada 30min', 'interval', 1800, true, 'pending', '{"ferramenta": "COM_MONITORAR_PROCESSOS", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- FISCAL IA: 07:00 conferir documentos pendentes
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_fiscal_id, 'Conferir Documentos Fiscais', 'Conferir documentos fiscais pendentes', 'scheduled', '0 7 * * 1-5', true, 'pending', '{"ferramenta": "COM_CONFERIR_CTE", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- CLIENTE IA: verificar consultas pendentes a cada hora
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, interval_seconds, ativo, status, config, proxima_execucao)
  VALUES (v_cliente_id, 'Consultas Pendentes Clientes', 'Processar consultas pendentes de clientes', 'interval', 3600, true, 'pending', '{"ferramenta": "COM_CONSULTAR_STATUS", "prioridade": "normal"}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  -- PRESTADOR IA: verificar escala do dia
  INSERT INTO rotinas_ia (robo_id, nome, descricao, tipo, cron_expression, ativo, status, config, proxima_execucao)
  VALUES (v_prestador_id, 'Verificar Escala Prestadores', 'Consultar escala de prestadores para o dia', 'scheduled', '0 5 * * 1-6', true, 'pending', '{"ferramenta": "COM_CONSULTAR_ESCALA", "prioridade": "alta"}'::jsonb, now())
  ON CONFLICT DO NOTHING;
END $$;
