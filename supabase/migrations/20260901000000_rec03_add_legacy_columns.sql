-- ============================================================
-- MIGRATION: 20260901_rec03_add_legacy_columns
-- PROJETO: TMS Conexão Express Hub
-- FASE: REC-03 — Eliminação de Ambiguidade candidatos × recrutamento_candidatos
-- DESCRIÇÃO:
--   Adiciona a `recrutamento_candidatos` todas as colunas legadas
--   de `candidatos` + colunas extras do enterpriseKanbanService.toDB(),
--   tornando-a um SUPERSET completo de ambas as tabelas.
--   Após esta migration, `recrutamento_candidatos` pode substituir
--   `candidatos` em todos os leitores migrados.
--
--   Colunas adicionadas (48 no total):
--   - De candidatos (17): nome_completo, cpf, whatsapp, regiao, tipo_veiculo,
--     tipo_carroceria, experiencia_anos, como_conheceu, mensagem_livre,
--     canal_captacao, status, score_perfil, ultima_interacao, prestador_id,
--     observacoes, avaliacao_nota, avaliacao_comentario
--   - Do enterpriseKanbanService (31): regioes_atuacao, historico,
--     horarios_disponiveis, dias_disponiveis, score_comprometimento,
--     classificacao_comprometimento, risco_desistencia,
--     tempo_medio_resposta_horas, quantidade_cobrancas,
--     confirmou_interesse, data_confirmacao_interesse,
--     confirmou_pre_inicio, data_confirmacao_pre_inicio,
--     compareceu_primeiro_dia, completou_30_dias,
--     quantidade_reclamacoes, possui_outra_operacao_fixa,
--     disponibilidade_recrutamento, historico_desistencias,
--     etiquetas_automaticas, parecer_ia, principais_riscos,
--     principais_pontos_positivos, proxima_acao_sugerida,
--     questionario_respostas
-- ============================================================

-- ============================================================
-- COLUNAS LEGADAS DE candidatos
-- ============================================================

-- nome_completo: alias para `nome` (legado usa nome_completo)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS nome_completo TEXT;

-- cpf: documento do candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS cpf TEXT;

-- whatsapp: número WhatsApp (separado de telefone)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- regiao: região de atuação (legado)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS regiao TEXT;

-- tipo_veiculo: alias para `veiculo` (legado usa tipo_veiculo)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS tipo_veiculo TEXT;

-- tipo_carroceria: tipo de carroceria do veículo
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS tipo_carroceria TEXT;

-- experiencia_anos: anos de experiência
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS experiencia_anos INTEGER;

-- como_conheceu: como o candidato conheceu a empresa
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS como_conheceu TEXT;

-- mensagem_livre: mensagem livre do candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS mensagem_livre TEXT;

-- canal_captacao: canal de captação do lead
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS canal_captacao TEXT DEFAULT 'link_direto';

-- status: status operacional legado (separado de stage)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'interessado';

-- score_perfil: score de perfil do candidato (legado)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS score_perfil NUMERIC DEFAULT 0;

-- ultima_interacao: timestamp da última interação
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS ultima_interacao TIMESTAMPTZ;

-- prestador_id: FK para prestadores (quando ativado)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES public.prestadores(id);

-- observacoes: observações gerais (legado — mapeado de/para observacoes_ia)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- avaliacao_nota: nota da avaliação do candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS avaliacao_nota NUMERIC DEFAULT 0;

-- avaliacao_comentario: comentário da avaliação
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS avaliacao_comentario TEXT DEFAULT '';

-- ============================================================
-- COLUNAS DO ENTERPRISE KANBAN SERVICE (toDB/fromDB)
-- ============================================================

-- regioes_atuacao: array de regiões de atuação
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS regioes_atuacao JSONB DEFAULT '[]'::jsonb;

-- historico: array de histórico de ações do candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS historico JSONB DEFAULT '[]'::jsonb;

-- horarios_disponiveis: horários disponíveis do candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS horarios_disponiveis TEXT DEFAULT '';

-- dias_disponiveis: dias da semana disponíveis
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS dias_disponiveis JSONB DEFAULT '[]'::jsonb;

-- score_comprometimento: score de comprometimento (0-100)
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS score_comprometimento NUMERIC DEFAULT 0;

-- classificacao_comprometimento: classificação qualitativa
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS classificacao_comprometimento TEXT DEFAULT '';

-- risco_desistencia: nível de risco de desistência
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS risco_desistencia TEXT DEFAULT '';

-- tempo_medio_resposta_horas: tempo médio de resposta em horas
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS tempo_medio_resposta_horas NUMERIC DEFAULT NULL;

-- quantidade_cobrancas: quantidade de cobranças realizadas
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS quantidade_cobrancas INTEGER DEFAULT 0;

-- confirmou_interesse: se o candidato confirmou interesse
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS confirmou_interesse BOOLEAN DEFAULT false;

-- data_confirmacao_interesse: data da confirmação de interesse
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS data_confirmacao_interesse TIMESTAMPTZ DEFAULT NULL;

-- confirmou_pre_inicio: se confirmou pré-início
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS confirmou_pre_inicio BOOLEAN DEFAULT false;

-- data_confirmacao_pre_inicio: data da confirmação pré-início
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS data_confirmacao_pre_inicio TIMESTAMPTZ DEFAULT NULL;

-- compareceu_primeiro_dia: se compareceu no primeiro dia
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS compareceu_primeiro_dia BOOLEAN DEFAULT false;

-- completou_30_dias: se completou 30 dias de operação
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS completou_30_dias BOOLEAN DEFAULT false;

-- quantidade_reclamacoes: quantidade de reclamações
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS quantidade_reclamacoes INTEGER DEFAULT 0;

-- possui_outra_operacao_fixa: se possui outra operação fixa
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS possui_outra_operacao_fixa BOOLEAN DEFAULT false;

-- disponibilidade_recrutamento: disponibilidade para recrutamento
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS disponibilidade_recrutamento TEXT DEFAULT '';

-- historico_desistencias: quantidade de desistências anteriores
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS historico_desistencias INTEGER DEFAULT 0;

-- etiquetas_automaticas: etiquetas geradas automaticamente pela IA
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS etiquetas_automaticas JSONB DEFAULT '[]'::jsonb;

-- parecer_ia: parecer gerado pela IA sobre o candidato
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS parecer_ia TEXT DEFAULT '';

-- principais_riscos: array de riscos identificados
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS principais_riscos JSONB DEFAULT '[]'::jsonb;

-- principais_pontos_positivos: array de pontos positivos
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS principais_pontos_positivos JSONB DEFAULT '[]'::jsonb;

-- proxima_acao_sugerida: próxima ação sugerida pela IA
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS proxima_acao_sugerida TEXT DEFAULT '';

-- questionario_respostas: respostas ao questionário de onboarding
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS questionario_respostas JSONB DEFAULT NULL;

-- ============================================================
-- SINCRONIZAR dados de candidatos → recrutamento_candidatos
-- (apenas para candidatos que NÃO existem em recrutamento_candidatos)
-- ============================================================
INSERT INTO public.recrutamento_candidatos (
  id, nome, nome_completo, cpf, telefone, whatsapp, email,
  cidade, uf, regiao, veiculo, tipo_veiculo, placa,
  tipo_carroceria, experiencia_anos, como_conheceu, mensagem_livre,
  canal_captacao, status, score, score_perfil,
  prioridade, observacoes, observacoes_ia,
  stage, created_at, updated_at
)
SELECT
  c.id,
  c.nome_completo AS nome,
  c.nome_completo,
  c.cpf,
  c.telefone,
  c.whatsapp,
  c.email,
  c.cidade,
  c.uf,
  c.regiao,
  c.tipo_veiculo AS veiculo,
  c.tipo_veiculo,
  c.placa,
  c.tipo_carroceria,
  c.experiencia_anos,
  c.como_conheceu,
  c.mensagem_livre,
  c.canal_captacao,
  c.status,
  COALESCE(c.score_perfil, 0)::INTEGER AS score,
  c.score_perfil,
  CASE
    WHEN c.prioridade >= 80 THEN 'alta'
    WHEN c.prioridade >= 50 THEN 'media'
    ELSE 'baixa'
  END AS prioridade,
  c.observacoes,
  c.observacoes AS observacoes_ia,
  CASE c.status
    WHEN 'interessado' THEN 'interesse_confirmado'
    WHEN 'triagem' THEN 'pre_triagem'
    WHEN 'documentacao' THEN 'documentacao_pendente'
    WHEN 'homologacao' THEN 'homologacao'
    WHEN 'aprovado' THEN 'aprovado'
    WHEN 'reprovado' THEN 'reprovado'
    WHEN 'inativo' THEN 'bloqueado'
    ELSE 'novo_cadastro'
  END AS stage,
  c.created_at,
  c.updated_at
FROM public.candidatos c
WHERE NOT EXISTS (
  SELECT 1 FROM public.recrutamento_candidatos rc WHERE rc.id = c.id
);

-- ============================================================
-- ÍNDICES para colunas frequentemente consultadas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rc_status_legacy ON public.recrutamento_candidatos(status);
CREATE INDEX IF NOT EXISTS idx_rc_tipo_veiculo ON public.recrutamento_candidatos(tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_rc_regiao ON public.recrutamento_candidatos(regiao);
CREATE INDEX IF NOT EXISTS idx_rc_cpf ON public.recrutamento_candidatos(cpf);
CREATE INDEX IF NOT EXISTS idx_rc_prestador_id ON public.recrutamento_candidatos(prestador_id);

-- ============================================================
-- COMENTÁRIO de documentação
-- ============================================================
COMMENT ON TABLE public.recrutamento_candidatos IS
  'REC-03: Tabela canônica de candidatos do pipeline. Superset de candidatos (legacy). '
  'Colunas nome_completo/tipo_veiculo/score_perfil/status são aliases legados para '
  'nome/veiculo/score/stage. candidatos é mantido apenas para recrutamentoIA e '
  'recrutamentoIntegracao (dependência de campos não migráveis).';

-- Notificar PGRST para reload do schema
NOTIFY pgrst, 'reload schema';
