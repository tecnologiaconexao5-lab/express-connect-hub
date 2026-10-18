-- =====================================================
-- F22: CENTRAL IA MODO SEGURO — TAREFAS, APROVAÇÕES, LOGS, MENSAGENS
-- =====================================================
-- Complementa as tabelas existentes (ia_*, automacoes_robos)
-- Adiciona: automacoes_tarefas, automacoes_aprovacoes, automacoes_logs, comunicacoes_mensagens
-- =====================================================

-- 1. AUTOMAÇÕES TAREFAS
CREATE TABLE IF NOT EXISTS public.automacoes_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID REFERENCES public.automacoes_robos(id) ON DELETE SET NULL,
  setor TEXT NOT NULL,
  tipo_tarefa TEXT NOT NULL DEFAULT 'geral',
  origem_tipo TEXT,
  origem_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_execucao','aguardando_aprovacao','concluida','falhou','cancelada')),
  executar_em TIMESTAMPTZ,
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  payload JSONB DEFAULT '{}'::jsonb,
  resultado JSONB DEFAULT '{}'::jsonb,
  responsavel_humano_id UUID,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_tarefas_robo ON public.automacoes_tarefas(robo_id);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_setor ON public.automacoes_tarefas(setor);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_status ON public.automacoes_tarefas(status);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_prioridade ON public.automacoes_tarefas(prioridade);

-- 2. AUTOMAÇÕES APROVAÇÕES
CREATE TABLE IF NOT EXISTS public.automacoes_aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID REFERENCES public.automacoes_tarefas(id) ON DELETE CASCADE,
  tipo_aprovacao TEXT NOT NULL CHECK (tipo_aprovacao IN (
    'proposta_comercial','contrato','desconto','alteracao_valor',
    'cancelamento_operacao','troca_motorista','troca_prestador',
    'resposta_reclamacao','resposta_ocorrencia_grave','emissao_fiscal',
    'mensagem_cliente','mensagem_prestador','outro'
  )),
  conteudo_original JSONB DEFAULT '{}'::jsonb,
  conteudo_sugerido JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','editado')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_aprov_tarefa ON public.automacoes_aprovacoes(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_auto_aprov_status ON public.automacoes_aprovacoes(status);
CREATE INDEX IF NOT EXISTS idx_auto_aprov_tipo ON public.automacoes_aprovacoes(tipo_aprovacao);

-- 3. AUTOMAÇÕES LOGS
CREATE TABLE IF NOT EXISTS public.automacoes_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID REFERENCES public.automacoes_robos(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES public.automacoes_tarefas(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entrada JSONB DEFAULT '{}'::jsonb,
  saida JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso','erro','info','aviso')),
  erro TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_logs_robo ON public.automacoes_logs(robo_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_tarefa ON public.automacoes_logs(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_acao ON public.automacoes_logs(acao);
CREATE INDEX IF NOT EXISTS idx_auto_logs_criado ON public.automacoes_logs(criado_em);

-- 4. COMUNICAÇÕES MENSAGENS (dry-run / simulação)
CREATE TABLE IF NOT EXISTS public.comunicacoes_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID REFERENCES public.automacoes_robos(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES public.automacoes_tarefas(id) ON DELETE SET NULL,
  origem_tipo TEXT,
  origem_id TEXT,
  destinatario_tipo TEXT NOT NULL CHECK (destinatario_tipo IN ('cliente','prestador','candidato','admin','setor')),
  destinatario_nome TEXT,
  canal TEXT NOT NULL DEFAULT 'simulado' CHECK (canal IN ('whatsapp','email','sms','simulado')),
  assunto TEXT,
  conteudo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','simulado','enviado','erro')),
  provider_message_id TEXT,
  modo_seguro BOOLEAN DEFAULT true,
  contexto JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_robo ON public.comunicacoes_mensagens(robo_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_tarefa ON public.comunicacoes_mensagens(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_status ON public.comunicacoes_mensagens(status);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_canal ON public.comunicacoes_mensagens(canal);

-- 5. RLS
ALTER TABLE public.automacoes_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacoes_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automacoes_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicacoes_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_tarefas_admin_all" ON public.automacoes_tarefas;
DROP POLICY IF EXISTS "auto_aprovacoes_admin_all" ON public.automacoes_aprovacoes;
DROP POLICY IF EXISTS "auto_logs_admin_all" ON public.automacoes_logs;
DROP POLICY IF EXISTS "comunicacoes_admin_all" ON public.comunicacoes_mensagens;

CREATE POLICY "auto_tarefas_admin_all" ON public.automacoes_tarefas
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auto_aprovacoes_admin_all" ON public.automacoes_aprovacoes
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auto_logs_admin_all" ON public.automacoes_logs
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "comunicacoes_admin_all" ON public.comunicacoes_mensagens
  FOR ALL USING (true) WITH CHECK (true);

-- 6. PERMISSÕES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_tarefas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_aprovacoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicacoes_mensagens TO anon, authenticated;

-- 7. NOTIFY para reload do schema
NOTIFY pgrst, 'reload schema';
