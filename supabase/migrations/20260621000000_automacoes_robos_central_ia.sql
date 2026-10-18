-- =====================================================
-- F21: CENTRAL IA — ROBÔS + MODOS + GOVERNANÇA
-- =====================================================
-- Complementa as tabelas ia_* e automacoes_* existentes
-- Adiciona: automacoes_robos, modo de operação, fallback
-- =====================================================

-- 1. ROBÔS DIGITAIS (funcionários automatizados por setor)
CREATE TABLE IF NOT EXISTS public.automacoes_robos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  setor TEXT NOT NULL,
  icone TEXT DEFAULT 'Bot',
  cor TEXT DEFAULT '#6366f1',
  modo TEXT NOT NULL DEFAULT 'manual'
    CHECK (modo IN ('manual', 'assistido', 'automatico_seguro')),
  status TEXT NOT NULL DEFAULT 'inativo'
    CHECK (status IN ('ativo', 'inativo', 'pausado', 'erro')),
  acoes_permitidas JSONB DEFAULT '[]'::jsonb,
  acoes_bloqueadas JSONB DEFAULT '[]'::jsonb,
  precisa_aprovacao JSONB DEFAULT '[]'::jsonb,
  mensagem_fallback TEXT DEFAULT 'Vou direcionar para o responsável pelo setor e já retorno com uma posição.',
  ultima_execucao TIMESTAMPTZ,
  total_execucoes INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_setor ON public.automacoes_robos(setor);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_modo ON public.automacoes_robos(modo);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_status ON public.automacoes_robos(status);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_ativo ON public.automacoes_robos(ativo);

-- 3. SEED: ROBÔS PADRÃO POR SETOR
INSERT INTO public.automacoes_robos (nome, descricao, setor, icone, cor, modo, acoes_permitidas, acoes_bloqueadas, precisa_aprovacao, mensagem_fallback) VALUES
  (
    'Comercial IA',
    'Atendimento de leads, follow-up automático e qualificação',
    'Comercial', 'BotMessageSquare', '#22c55e', 'assistido',
    '["responder_orcamento", "qualificar_lead", "enviar_followup", "gerar_proposta"]'::jsonb,
    '["fechar_contrato", "alterar_precos", "enviar_fatura"]'::jsonb,
    '["enviar_proposta_acima_teto", "responder_reclamacao"]'::jsonb,
    'Vou direcionar seu contato para o comercial e já retorno com uma posição.'
  ),
  (
    'Operacional IA',
    'Gestão de OS, escala, tracking e POD',
    'Operacional', 'Truck', '#f59e0b', 'assistido',
    '["criar_os", "alocar_prestador", "notificar_coleta", "notificar_entrega"]'::jsonb,
    '["cancelar_os", "alterar_valor_cliente", "reembolsar"]'::jsonb,
    '["alocar_acima_orcamento", "cancelar_os_em_andamento"]'::jsonb,
    'Vou direcionar para a operação e já retorno com uma posição.'
  ),
  (
    'Recrutamento IA',
    'Triagem de candidatos, agendamento e convites',
    'Recrutamento', 'UserCheck', '#a855f7', 'assistido',
    '["triar_candidato", "convidar_entrevista", "enviar_mensagem"]'::jsonb,
    '["aprovar_candidato", "cadastrar_prestador", "excluir_candidato"]'::jsonb,
    '["aprovar_cadastro", "alterar_status_triagem"]'::jsonb,
    'Vou direcionar para o RH e já retorno com uma posição.'
  ),
  (
    'Financeiro IA',
    'Cobrança simples, envio de boletos e consultas',
    'Financeiro', 'DollarSign', '#10b981', 'manual',
    '["consultar_saldo", "enviar_boleto", "lembrar_vencimento"]'::jsonb,
    '["cancelar_fatura", "aplicar_desconto", "alterar_data_vencimento"]'::jsonb,
    '["enviar_boleto_acima_valor", "negociar_desconto"]'::jsonb,
    'Vou direcionar para o financeiro e já retorno com uma posição.'
  ),
  (
    'Fiscal IA',
    'Classificação de XML, conferência de CT-e e NFSe',
    'Fiscal', 'FileText', '#3b82f6', 'manual',
    '["classificar_xml", "conferir_dados_fiscais"]'::jsonb,
    '["emitir_cte", "cancelar_cte", "alterar_dados_fiscais"]'::jsonb,
    '["emitir_documento_fiscal", "corrigir_dados"]'::jsonb,
    'Vou direcionar para o fiscal e já retorno com uma posição.'
  ),
  (
    'Monitoramento IA',
    'Alertas de atraso, ocorrências e tracking',
    'Monitoramento', 'BellRing', '#ef4444', 'automatico_seguro',
    '["detectar_atraso", "notificar_ocorrencia", "sugerir_rota_alternativa"]'::jsonb,
    '["alterar_rota", "contatar_motorista", "cancelar_os"]'::jsonb,
    '["sugerir_rota_alternativa_com_custo"]'::jsonb,
    'Vou direcionar para o monitoramento e já retorno com uma posição.'
  ),
  (
    'Cliente IA',
    'Atendimento no portal do cliente, dúvidas e status',
    'Cliente', 'Headphones', '#06b6d4', 'automatico_seguro',
    '["responder_duvida", "consultar_status_os", "consultar_pod", "consultar_financeiro"]'::jsonb,
    '["alterar_pedido", "cancelar_pedido", "alterar_dados_cadastrais"]'::jsonb,
    '["responder_reclamacao_formal", "alterar_dados_sensiveis"]'::jsonb,
    'Vou direcionar para o suporte ao cliente e já retorno com uma posição.'
  ),
  (
    'Prestador IA',
    'Atendimento ao motorista via App/WhatsApp',
    'Prestador/Motorista', 'Smartphone', '#ec4899', 'automatico_seguro',
    '["responder_duvida", "informar_status_os", "orientar_documentos"]'::jsonb,
    '["cancelar_alocacao", "alterar_valor_repasse", "bloquear_prestador"]'::jsonb,
    '["responder_reclamacao_trabalhista"]'::jsonb,
    'Vou direcionar para o suporte ao motorista e já retorno com uma posição.'
  )
ON CONFLICT DO NOTHING;

-- 4. RLS
ALTER TABLE public.automacoes_robos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automacoes_robos_admin_all" ON public.automacoes_robos;
DROP POLICY IF EXISTS "automacoes_robos_anon_all" ON public.automacoes_robos;
DROP POLICY IF EXISTS "automacoes_robos_select_all" ON public.automacoes_robos;

CREATE POLICY "automacoes_robos_admin_all" ON public.automacoes_robos
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "automacoes_robos_anon_all" ON public.automacoes_robos
  FOR ALL USING (true)
  WITH CHECK (true);

-- 5. ATUALIZAR TABELAS EXISTENTES (idempotente)
-- Adicionar coluna modo_operacao em ia_setores se não existir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ia_setores' AND column_name = 'modo_operacao'
  ) THEN
    ALTER TABLE public.ia_setores ADD COLUMN modo_operacao TEXT DEFAULT 'assistido'
      CHECK (modo_operacao IN ('manual', 'assistido', 'automatico_seguro'));
  END IF;
END $$;

-- Adicionar coluna fallback_msg em ia_setores se não existir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ia_setores' AND column_name = 'fallback_msg'
  ) THEN
    ALTER TABLE public.ia_setores ADD COLUMN fallback_msg TEXT DEFAULT 'Vou direcionar para o responsável pelo setor e já retorno com uma posição.';
  END IF;
END $$;

-- 6. PERMISSÕES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_robos TO anon, authenticated;

-- 7. VIEW UNIFICADA PARA DASHBOARD CENTRAL IA
CREATE OR REPLACE VIEW public.central_ia_dashboard_view AS
SELECT
  'robo' as tipo_entidade,
  ar.id,
  ar.nome,
  ar.setor,
  ar.status,
  ar.modo,
  ar.ultima_execucao,
  ar.total_execucoes,
  ar.total_erros,
  ar.ativo,
  ar.criado_em
FROM public.automacoes_robos ar
UNION ALL
SELECT
  'tarefa' as tipo_entidade,
  ita.id,
  ita.titulo as nome,
  COALESCE(iset.nome, ita.tipo_tarefa) as setor,
  CASE
    WHEN ita.status = 'pendente' THEN 'pendente'
    WHEN ita.status = 'em_andamento' THEN 'ativo'
    WHEN ita.status = 'concluido' THEN 'concluido'
    WHEN ita.status = 'erro' THEN 'erro'
    ELSE 'inativo'
  END as status,
  'assistido' as modo,
  ita.executado_em as ultima_execucao,
  0 as total_execucoes,
  CASE WHEN ita.status = 'erro' THEN 1 ELSE 0 END as total_erros,
  CASE WHEN ita.status NOT IN ('cancelada', 'erro', 'concluido') THEN true ELSE false END as ativo,
  ita.criado_em
FROM public.ia_tarefas_automaticas ita
LEFT JOIN public.ia_setores iset ON iset.id = ita.setor_id
UNION ALL
SELECT
  'aprovacao' as tipo_entidade,
  iah.id,
  iah.titulo as nome,
  COALESCE(iset.nome, 'Geral') as setor,
  iah.status,
  'manual' as modo,
  iah.criado_em as ultima_execucao,
  0 as total_execucoes,
  0 as total_erros,
  CASE WHEN iah.status IN ('pendente', 'em_analise') THEN true ELSE false END as ativo,
  iah.criado_em
FROM public.ia_aprovacoes_humanas iah
LEFT JOIN public.ia_setores iset ON iset.id = iah.setor_id;

GRANT SELECT ON public.central_ia_dashboard_view TO anon, authenticated;
