-- ============================================================
-- MIGRATION: 20260630_f25f1_gatilho_instrucao_recrutamento
-- PROJETO: TMS Conexão Express Hub
-- FASE: F25F.1 — Gatilho novo_candidato + Instrução inicial
-- DESCRIÇÃO:
--   Prepara a estrutura mínima para o Robô de Recrutamento IA.
--   Cria o gatilho "novo_candidato" e a instrução inicial
--   genérica do robô. Toda inteligência de negócio será
--   carregada dinamicamente de configurações, conhecimento,
--   regras operacionais e dados reais do candidato.
-- ============================================================

-- ============================================================
-- PARTE 1: EXPANDIR automacoes_robos (F25B)
-- Garante os campos de configuração e segurança por robô.
-- Necessário pois a migration F25B não foi aplicada neste db.
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'canal_principal') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN canal_principal TEXT DEFAULT 'interno';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'nivel_autonomia') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN nivel_autonomia TEXT DEFAULT 'manual' CHECK (nivel_autonomia IN ('manual','assistido','automatico_seguro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'responsavel_humano_id') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN responsavel_humano_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'modo_atual') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN modo_atual TEXT DEFAULT 'seguro' CHECK (modo_atual IN ('seguro','homologacao','producao_assistida','producao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'setor_responsavel') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN setor_responsavel TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'permite_envio_externo') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN permite_envio_externo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'exige_aprovacao_humana') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN exige_aprovacao_humana BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'limite_mensagens_dia') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN limite_mensagens_dia INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'horario_inicio') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN horario_inicio TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'horario_fim') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN horario_fim TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'tom_conversa') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN tom_conversa TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'instrucoes_resumo') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN instrucoes_resumo TEXT;
  END IF;
END $$;

-- ============================================================
-- PARTE 2: ATUALIZAR ROBÔ RECRUTAMENTO IA
-- Aplica configurações seguras ao robô existente.
-- ============================================================
DO $$
DECLARE
  v_robo_id uuid;
BEGIN
  SELECT id INTO v_robo_id FROM public.automacoes_robos
  WHERE nome = 'Recrutamento IA' AND setor = 'Recrutamento';

  IF v_robo_id IS NOT NULL THEN
    UPDATE public.automacoes_robos
    SET
      descricao = 'Robô digital para triagem, recomendação e encaminhamento de candidatos. Toda inteligência é carregada dinamicamente de instruções, conhecimento e regras cadastradas no painel.',
      icone = 'UserCheck',
      cor = '#a855f7',
      modo = 'assistido',
      modo_atual = 'seguro',
      nivel_autonomia = 'assistido',
      permite_envio_externo = false,
      exige_aprovacao_humana = true,
      canal_principal = 'interno',
      limite_mensagens_dia = 0,
      acoes_permitidas = '["triar_candidato", "convidar_entrevista", "enviar_mensagem"]'::jsonb,
      acoes_bloqueadas = '["aprovar_candidato", "cadastrar_prestador", "excluir_candidato"]'::jsonb,
      precisa_aprovacao = '["aprovar_cadastro", "alterar_status_triagem"]'::jsonb,
      mensagem_fallback = 'Vou direcionar seu cadastro para o setor de recrutamento e já retorno com uma posição.',
      atualizado_em = now()
    WHERE id = v_robo_id;
  END IF;
END $$;

-- ============================================================
-- PARTE 3: CRIAR TABELA automacoes_instrucoes (F25C)
-- Instruções versionadas por robô (rascunho → revisão → publicado → arquivado).
-- Necessário pois a migration F25C não foi aplicada neste db.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_instrucao') THEN
    CREATE TYPE status_instrucao AS ENUM ('rascunho', 'em_revisao', 'publicado', 'arquivado');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS automacoes_instrucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  objetivo text,
  tom_de_conversa text,
  regras_fixas text,
  perguntas_obrigatorias text,
  respostas_padrao jsonb DEFAULT '[]'::jsonb,
  limites_de_atuacao text,
  quando_chamar_humano text,
  proibicoes text,
  exemplos_de_conversa jsonb DEFAULT '[]'::jsonb,
  instrucoes_completas text,
  status text NOT NULL DEFAULT 'rascunho',
  ativo boolean NOT NULL DEFAULT false,
  criado_por uuid,
  publicado_por uuid,
  publicado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_instrucao_check CHECK (status IN ('rascunho', 'em_revisao', 'publicado', 'arquivado'))
);

-- Apenas uma instrução ativa por robô
CREATE UNIQUE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo_ativo
  ON automacoes_instrucoes (robo_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo
  ON automacoes_instrucoes (robo_id);

CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_status
  ON automacoes_instrucoes (status);

-- Trigger: apenas uma instrução ativa por robô
CREATE OR REPLACE FUNCTION check_automacoes_instrucoes_ativa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ativo = true AND NEW.status = 'publicado' THEN
    UPDATE automacoes_instrucoes
    SET ativo = false
    WHERE robo_id = NEW.robo_id
      AND id <> NEW.id
      AND ativo = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automacoes_instrucoes_ativa ON automacoes_instrucoes;
CREATE TRIGGER trg_automacoes_instrucoes_ativa
  AFTER INSERT OR UPDATE OF ativo, status
  ON automacoes_instrucoes
  FOR EACH ROW
  WHEN (NEW.ativo = true AND NEW.status = 'publicado')
  EXECUTE FUNCTION check_automacoes_instrucoes_ativa();

-- ============================================================
-- PARTE 4: CRIAR INSTRUÇÃO INICIAL DO ROBÔ DE RECRUTAMENTO
-- Instrução genérica e permanente. NÃO contém regras de
-- negócio específicas (cidades, veículos, valores, experiência).
-- ============================================================
DO $$
DECLARE
  v_robo_id uuid;
  v_versao integer;
BEGIN
  SELECT id INTO v_robo_id FROM public.automacoes_robos
  WHERE nome = 'Recrutamento IA' AND setor = 'Recrutamento';

  IF v_robo_id IS NULL THEN
    RAISE WARNING 'Robô Recrutamento IA não encontrado — instrução inicial não criada.';
    RETURN;
  END IF;

  -- Verificar se já existe instrução publicada
  IF EXISTS (SELECT 1 FROM automacoes_instrucoes WHERE robo_id = v_robo_id AND status = 'publicado' AND ativo = true) THEN
    RAISE NOTICE 'Instrução ativa já existe para o robô Recrutamento IA — pulando criação.';
    RETURN;
  END IF;

  -- Verificar se já existe instrução em rascunho
  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM automacoes_instrucoes
  WHERE robo_id = v_robo_id;

  -- Inserir instrução inicial
  INSERT INTO automacoes_instrucoes (
    robo_id, versao, objetivo, tom_de_conversa, regras_fixas,
    perguntas_obrigatorias, respostas_padrao, limites_de_atuacao,
    quando_chamar_humano, proibicoes, exemplos_de_conversa,
    instrucoes_completas, status, ativo
  ) VALUES (
    v_robo_id,
    v_versao,
    'Realizar a triagem inicial de candidatos com base exclusivamente nas informações disponíveis na configuração do robô, conhecimento ativo, regras operacionais e dados reais fornecidos pelo candidato. O robô não deve criar, inferir ou assumir informações que não estejam explicitamente cadastradas.',
    'Profissional, claro e objetivo. Tratar o candidato com respeito e cordialidade, sem promessas ou garantias não autorizadas. Não utilizar gírias ou linguagem excessivamente informal.',
    '1. Utilizar APENAS informações explicitamente cadastradas na base de conhecimento, regras operacionais e dados do candidato. Nunca inventar requisitos, critérios ou oportunidades.\n2. Toda recomendação deve ser baseada exclusivamente nos dados disponíveis no momento da análise.\n3. Se uma informação necessária não estiver disponível, informar ao candidato que o setor responsável analisará o cadastro.\n4. Nunca afirmar que uma vaga, operação ou oportunidade específica existe sem confirmação nas regras operacionais.\n5. Qualquer decisão que envolva aprovação, valor, contratação ou alteração de status deve obrigatoriamente passar por aprovação humana.',
    'Coletar do candidato as informações mínimas para cadastro: nome completo, telefone de contato, região onde deseja atuar, tipo de veículo (se aplicável), experiência na área e como conheceu a empresa. Registrar todas as respostas para análise posterior.',
    '[]'::jsonb,
    'O robô pode: triar informações básicas do candidato, verificar completude do cadastro, gerar recomendação inicial de perfil, sugerir próximos passos com base nas regras cadastradas.\nO robô NÃO pode: aprovar ou reprovar candidatos, prometer vagas ou valores, alterar status sem aprovação humana, enviar mensagens externas sem autorização.',
    'Encaminhar para humano quando:\n- O candidato solicitar informações sobre valores, pagamento ou benefícios.\n- O candidato questionar sobre status de aprovação.\n- O candidato reportar problema técnico no cadastro.\n- A situação exigir decisão fora das regras cadastradas.\n- Houver dúvida sobre a veracidade dos documentos ou informações.\n- O candidato solicitar alteração de dados sensíveis.\n- Houver qualquer solicitação de informação que não esteja disponível na base de conhecimento ou regras operacionais.',
    '1. Nunca informar ao candidato que está falando com um robô, IA ou sistema automatizado.\n2. Nunca prometer vagas, oportunidades, valores, pagamentos ou benefícios.\n3. Nunca aprovar ou reprovar o cadastro de um candidato.\n4. Nunca criar informações sobre treinamentos, datas, locais ou horários.\n5. Nunca fazer afirmações sobre disponibilidade de vagas em regiões ou cidades específicas.\n6. Nunca compartilhar informações de outros candidatos ou dados internos da empresa.\n7. Nunca alterar dados cadastrais sem confirmação e registro.\n8. Nunca prometer retorno em prazo específico sem garantia do setor responsável.',
    '[]'::jsonb,
    'Você é o assistente de recrutamento da Conexão Express. Sua função é realizar a triagem inicial de novos candidatos que desejam se cadastrar como prestadores de serviço de transporte.\n\nVocê deve sempre:\n1. Cumprimentar o candidato de forma profissional.\n2. Explicar brevemente o processo de cadastro.\n3. Coletar as informações necessárias.\n4. Analisar as informações com base no que está cadastrado na base de conhecimento e nas regras operacionais.\n5. Gerar uma recomendação inicial (favorável, precisa de revisão, ou encaminhar para humano).\n6. Registrar tudo para aprovação humana.\n7. Comunicar ao candidato que o cadastro será analisado.\n\nLembre-se: você NÃO toma decisões finais. Você apenas prepara a recomendação para que um humano aprove.',
    'publicado',
    true
  );

  -- Registrar auditoria
  INSERT INTO automacoes_logs (robo_id, acao, entrada, saida, status)
  VALUES (
    v_robo_id,
    'instrucao_inicial_criada',
    ('{"versao": ' || v_versao || ', "origem": "F25F.1"}')::jsonb,
    '{}'::jsonb,
    'sucesso'
  );
END $$;

-- ============================================================
-- PARTE 5: CRIAR TABELA automacoes_gatilhos (F25E)
-- Gatilhos, alertas e escalonamento por robô.
-- Necessário pois a migration F25E não foi aplicada neste db.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_risco') THEN
    CREATE TYPE nivel_risco AS ENUM ('baixo', 'medio', 'alto', 'critico');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_acao_gatilho') THEN
    CREATE TYPE tipo_acao_gatilho AS ENUM (
      'criar_tarefa', 'criar_aprovacao', 'criar_alerta',
      'acionar_humano', 'executar_robo_simulado', 'notificar_setor'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS automacoes_gatilhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id uuid NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  setor text NOT NULL,
  evento text NOT NULL,
  descricao text,
  cliente_id uuid,
  operacao_id uuid,
  regiao text,
  prioridade text NOT NULL DEFAULT 'normal',
  status_anterior text,
  status_novo text,
  condicao_json jsonb DEFAULT '{}'::jsonb,
  tipo_acao text NOT NULL DEFAULT 'criar_tarefa',
  criar_tarefa boolean DEFAULT true,
  criar_aprovacao boolean DEFAULT false,
  criar_alerta boolean DEFAULT false,
  acionar_humano boolean DEFAULT false,
  executar_robo_simulado boolean DEFAULT false,
  exige_aprovacao_humana boolean DEFAULT true,
  permite_execucao_automatica boolean DEFAULT false,
  nivel_risco text NOT NULL DEFAULT 'medio',
  limite_execucoes integer DEFAULT 0,
  ativo boolean DEFAULT true,
  horario_inicio time,
  horario_fim time,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prioridade_gatilho_check CHECK (prioridade IN ('baixa', 'normal', 'alta', 'critica')),
  CONSTRAINT tipo_acao_gatilho_check CHECK (tipo_acao IN ('criar_tarefa', 'criar_aprovacao', 'criar_alerta', 'acionar_humano', 'executar_robo_simulado', 'notificar_setor')),
  CONSTRAINT nivel_risco_gatilho_check CHECK (nivel_risco IN ('baixo', 'medio', 'alto', 'critico'))
);

CREATE INDEX IF NOT EXISTS idx_gatilhos_robo ON automacoes_gatilhos (robo_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_setor ON automacoes_gatilhos (setor);
CREATE INDEX IF NOT EXISTS idx_gatilhos_evento ON automacoes_gatilhos (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_prioridade ON automacoes_gatilhos (prioridade);
CREATE INDEX IF NOT EXISTS idx_gatilhos_ativo ON automacoes_gatilhos (ativo);

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION update_gatilhos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gatilhos_updated_at ON automacoes_gatilhos;
CREATE TRIGGER trg_gatilhos_updated_at
  BEFORE UPDATE ON automacoes_gatilhos
  FOR EACH ROW
  EXECUTE FUNCTION update_gatilhos_updated_at();

-- ============================================================
-- PARTE 6: CRIAR TABELA automacoes_gatilhos_execucao (F25E)
-- Log de execuções dos gatilhos.
-- ============================================================
CREATE TABLE IF NOT EXISTS automacoes_gatilhos_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gatilho_id uuid NOT NULL REFERENCES automacoes_gatilhos(id) ON DELETE CASCADE,
  robo_id uuid REFERENCES automacoes_robos(id) ON DELETE SET NULL,
  evento text NOT NULL,
  tipo_acao text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  resultado jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processado',
  erro text,
  executado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_gatilho ON automacoes_gatilhos_execucao (gatilho_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_evento ON automacoes_gatilhos_execucao (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_status ON automacoes_gatilhos_execucao (status);

-- ============================================================
-- PARTE 7: CRIAR GATILHO "novo_candidato"
-- Representa o evento de entrada de um novo candidato no
-- sistema. Não dispara ações externas — apenas cria tarefa
-- para preparar a análise pelo Robô de Recrutamento.
-- ============================================================
DO $$
DECLARE
  v_robo_id uuid;
BEGIN
  SELECT id INTO v_robo_id FROM public.automacoes_robos
  WHERE nome = 'Recrutamento IA' AND setor = 'Recrutamento';

  IF v_robo_id IS NULL THEN
    RAISE WARNING 'Robô Recrutamento IA não encontrado — gatilho não criado.';
    RETURN;
  END IF;

  -- Verificar se já existe gatilho para este evento neste robô
  IF EXISTS (SELECT 1 FROM automacoes_gatilhos WHERE robo_id = v_robo_id AND evento = 'novo_candidato' AND ativo = true) THEN
    RAISE NOTICE 'Gatilho novo_candidato já existe para o robô Recrutamento IA — pulando criação.';
    RETURN;
  END IF;

  INSERT INTO automacoes_gatilhos (
    robo_id, nome, setor, evento, descricao,
    prioridade, tipo_acao,
    criar_tarefa, criar_aprovacao, criar_alerta,
    acionar_humano, executar_robo_simulado,
    exige_aprovacao_humana, permite_execucao_automatica,
    nivel_risco, limite_execucoes, ativo
  ) VALUES (
    v_robo_id,
    'Novo Candidato',
    'Recrutamento',
    'novo_candidato',
    'Disparado quando um novo candidato é cadastrado no sistema. O robô carrega a configuração, instrução ativa, conhecimento e regras para preparar a recomendação inicial. Nenhuma comunicação externa é disparada por este gatilho.',
    'normal',
    'criar_tarefa',
    true,   -- criar_tarefa: cria tarefa para análise
    false,  -- criar_aprovacao: aprovação será criada pelo robô após análise
    false,  -- criar_alerta
    false,  -- acionar_humano: humano será acionado via tarefa
    true,   -- executar_robo_simulado: permite execução simulada para testes
    true,   -- exige_aprovacao_humana
    false,  -- permite_execucao_automatica
    'baixo', -- nivel_risco: cadastro de candidato é baixo risco
    0,       -- limite_execucoes: sem limite
    true     -- ativo
  );

  -- Registrar auditoria
  INSERT INTO automacoes_logs (robo_id, acao, entrada, saida, status)
  VALUES (
    v_robo_id,
    'gatilho_novo_candidato_criado',
    '{"evento": "novo_candidato", "origem": "F25F.1"}'::jsonb,
    '{}'::jsonb,
    'sucesso'
  );
END $$;

-- ============================================================
-- PARTE 8: PERMISSÕES
-- ============================================================
GRANT ALL ON public.automacoes_instrucoes TO anon, authenticated;
GRANT ALL ON public.automacoes_gatilhos TO anon, authenticated;
GRANT ALL ON public.automacoes_gatilhos_execucao TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
