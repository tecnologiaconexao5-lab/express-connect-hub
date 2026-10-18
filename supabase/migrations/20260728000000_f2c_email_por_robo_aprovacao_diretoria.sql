-- FASE P2C — Email Corporativo com Remetente por Robô e Aprovação da Diretoria
--
-- 1. Configura config.email.from em cada robô (remetente por setor)
-- 2. Configura from_by_robo no conector CON_ZOHO_EMAIL (fallback via credentials)
-- 3. Garante que todas as ferramentas de envio externo tenham precisa_aprovacao=true
-- 4. Prepara estrutura para recebimento futuro de XML pelo Fiscal IA

-- ============================================================
-- 1. Remetente por robô (config.email.from)
-- ============================================================
UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "comercial@conexaoexpress.com.br"}'::jsonb
)
WHERE setor = 'Comercial';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "operacional@conexaoexpress.com.br"}'::jsonb
)
WHERE setor = 'Operacional';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "financeiro@conexaoexpress.com.br"}'::jsonb
)
WHERE setor = 'Financeiro';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "operacional@conexaoexpress.com.br"}'::jsonb
)
WHERE setor = 'Fiscal';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "contato@conexaoexpress.com.br"}'::jsonb
)
WHERE setor IN ('Cliente', 'Recrutamento', 'Prestador', 'Prestador/Motorista');

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{email}',
  '{"from": "contato@conexaoexpress.com.br"}'::jsonb
)
WHERE setor = 'Monitoramento';

-- ============================================================
-- 2. from_by_robo no conector CON_ZOHO_EMAIL (fallback via banco)
-- ============================================================
UPDATE ia_conectores
SET credenciais = jsonb_set(
  COALESCE(credenciais, '{}'::jsonb),
  '{from_by_robo}',
  '{}'::jsonb
)
WHERE codigo_unico = 'CON_ZOHO_EMAIL';

-- ============================================================
-- 3. Garantir precisa_aprovacao=true nas ferramentas de envio externo
-- ============================================================
UPDATE ia_ferramentas
SET precisa_aprovacao = true
WHERE codigo_unico IN (
  'COM_ENVIAR_EMAIL',
  'COM_ENVIAR_CONVITE',
  'COM_GERAR_RELATORIO',
  'COM_REGISTRAR_FOLLOWUP',
  'COM_REGISTRAR_PAGAMENTO',
  'COM_REALIZAR_COBRANCA',
  'COM_ENVIAR_BOLETO'
);

-- Garantir EXECUTAR_COM_APROVACAO nos vínculos destas ferramentas
UPDATE ia_robo_ferramentas rf
SET nivel_autonomia = 'EXECUTAR_COM_APROVACAO'
FROM ia_ferramentas f
WHERE rf.ferramenta_id = f.id
  AND f.codigo_unico IN (
    'COM_ENVIAR_EMAIL',
    'COM_ENVIAR_CONVITE',
    'COM_GERAR_RELATORIO',
    'COM_REGISTRAR_FOLLOWUP',
    'COM_REGISTRAR_PAGAMENTO',
    'COM_REALIZAR_COBRANCA',
    'COM_ENVIAR_BOLETO'
  )
  AND rf.nivel_autonomia = 'EXECUTAR_AUTONOMO';

-- ============================================================
-- 4. Preparação para recebimento futuro de XML pelo Fiscal IA
-- ============================================================
-- Cria função de notificação para quando novos XMLs chegarem via email
CREATE OR REPLACE FUNCTION notificar_xml_recebido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Future: quando um anexo XML for recebido por contato@ ou operacional@,
  -- este trigger será chamado para criar tarefa para o Fiscal IA.
  -- Exemplo de uso futuro:
  --
  -- INSERT INTO automacoes_tarefas (robo_id, setor, tipo_tarefa, titulo, descricao, prioridade, payload)
  -- VALUES (
  --   (SELECT id FROM automacoes_robos WHERE setor = 'Fiscal' LIMIT 1),
  --   'Fiscal',
  --   'analise_xml',
  --   'XML recebido - ' || COALESCE(NEW.remetente, 'desconhecido'),
  --   'Documento XML recebido para análise fiscal. Anexo: ' || COALESCE(NEW.nome_arquivo, 'N/A'),
  --   'alta',
  --   jsonb_build_object('anexo_id', NEW.id, 'conteudo', NEW.conteudo_xml, 'remetente', NEW.remetente)
  -- );
  RETURN NEW;
END;
$$;

-- Tabela para recebimento futuro de anexos XML por email
CREATE TABLE IF NOT EXISTS fiscal_xml_recebidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  assunto TEXT,
  corpo_email TEXT,
  nome_arquivo TEXT NOT NULL,
  conteudo_xml TEXT,
  xml_parsed JSONB,
  status TEXT NOT NULL DEFAULT 'pendente',
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  tarefa_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger será ativado quando a lógica de recebimento de email for implementada
-- CREATE TRIGGER trg_notificar_xml_recebido
--   AFTER INSERT ON fiscal_xml_recebidos
--   FOR EACH ROW
--   WHEN (NEW.status = 'pendente')
--   EXECUTE FUNCTION notificar_xml_recebido();
