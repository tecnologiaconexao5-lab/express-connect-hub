-- Migração de Setup Completo do Banco de Dados
-- Sistema: Conexão Express Transportes
-- Módulos: Usuários, Administrativo, Comercial, Operacional, Financeiro, Fiscal, CRM

-- ==========================================
-- 1. HABILITAR EXTENSÕES
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CRIAÇÃO DE TABELAS
-- ==========================================

-- TABELAS AUXILIARES E CADASTROS
CREATE TABLE IF NOT EXISTS regioes ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome text, ativo boolean DEFAULT true, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS filiais ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome text, cnpj text, ativo boolean DEFAULT true, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS unidades ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, filial_id uuid REFERENCES filiais(id), nome text, ativo boolean DEFAULT true, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS centros_custo ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome text, codigo text, ativo boolean DEFAULT true, created_at timestamp with time zone DEFAULT now() );

-- TABELAS BASE (PERFIS, CLIENTES, PRESTADORES)
CREATE TABLE IF NOT EXISTS perfis ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome text, nivel text, permissoes jsonb, created_at timestamp with time zone DEFAULT now() );

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  perfil_id uuid REFERENCES perfis(id),
  unidade_id uuid REFERENCES unidades(id),
  nome text, email text, status text DEFAULT 'ativo', created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, razao_social text, cnpj text, segmento text, porte text, status text DEFAULT 'ativo', user_id uuid REFERENCES usuarios(id), created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_addresses ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, cliente_id uuid REFERENCES clientes(id), tipo text, cep text, logradouro text, numero text, bairro text, cidade text, uf text, padrao boolean DEFAULT false, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS client_contacts ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, cliente_id uuid REFERENCES clientes(id), nome text, cargo text, telefone text, email text, principal boolean DEFAULT false, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS client_commercial_rules ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, cliente_id uuid REFERENCES clientes(id), prazo_pagamento text, tabela_aplicavel_id uuid, limite_credito numeric, status text, created_at timestamp with time zone DEFAULT now() );

CREATE TABLE IF NOT EXISTS prestadores (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome_razao text, cpf_cnpj text, tipo_parceiro text, status text DEFAULT 'ativo', score numeric, user_id uuid REFERENCES usuarios(id), created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_documents ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, prestador_id uuid REFERENCES prestadores(id), tipo text, url text, validade date, status text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS provider_emergency_contacts ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, prestador_id uuid REFERENCES prestadores(id), nome text, parentesco text, telefone text, created_at timestamp with time zone DEFAULT now() );

CREATE TABLE IF NOT EXISTS veiculos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, prestador_id uuid REFERENCES prestadores(id), placa text, tipo text, capacidade_kg numeric, termico boolean DEFAULT false, status text DEFAULT 'ativo', created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS vehicle_documents ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, veiculo_id uuid REFERENCES veiculos(id), tipo text, validade date, status text, created_at timestamp with time zone DEFAULT now() );

-- COMERCIAL
CREATE TABLE IF NOT EXISTS tabelas_valores ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, nome text, cliente_id uuid REFERENCES clientes(id), base_calculo text, status text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS price_table_rules ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, tabela_id uuid REFERENCES tabelas_valores(id), uf_origem text, uf_destino text, valor_base numeric, valor_kg_excedente numeric, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS price_table_additionals ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, tabela_id uuid REFERENCES tabelas_valores(id), tipo_adicional text, taxa_fixa numeric, percentual numeric, created_at timestamp with time zone DEFAULT now() );

CREATE TABLE IF NOT EXISTS orcamentos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, numero text, cliente_id uuid REFERENCES clientes(id), valor_total numeric, status text DEFAULT 'rascunho', filial_origem text, vigencia date, observacoes text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS orcamento_enderecos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, orcamento_id uuid REFERENCES orcamentos(id), tipo text, cep text, cidade text, uf text, valor_trecho numeric, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS crm_oportunidades ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, cliente_id uuid REFERENCES clientes(id), titulo text, valor_estimado numeric, estagio text, fechamento_esperado date, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS contratos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, cliente_id uuid REFERENCES clientes(id), prestador_id uuid REFERENCES prestadores(id), tipo text, vigencia_inicio date, vigencia_fim date, status text, arquivo_url text, created_at timestamp with time zone DEFAULT now() );

-- OPERACIONAL
CREATE TABLE IF NOT EXISTS ordens_servico ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, numero text, cliente_id uuid REFERENCES clientes(id), prestador_id uuid REFERENCES prestadores(id), veiculo_id uuid REFERENCES veiculos(id), orcamento_id uuid REFERENCES orcamentos(id), status text, valor_frete numeric, data_previsao timestamp with time zone, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS os_enderecos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, os_id uuid REFERENCES ordens_servico(id), tipo text, sequencia integer, cep text, logradouro text, nome_local text, status_ponto text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS os_historico ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, os_id uuid REFERENCES ordens_servico(id), acao text, status_novo text, observacao text, usuario_id uuid REFERENCES usuarios(id), created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS os_documentos ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, os_id uuid REFERENCES ordens_servico(id), tipo text, url text, uploaded_by uuid REFERENCES usuarios(id), created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS ocorrencias ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, os_id uuid REFERENCES ordens_servico(id), tipo text, descricao text, severidade text, status text, resolvida_em timestamp with time zone, created_at timestamp with time zone DEFAULT now() );

-- FINANCEIRO
CREATE TABLE IF NOT EXISTS financeiro_receber ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, fatura text, cliente_id uuid REFERENCES clientes(id), os_id uuid REFERENCES ordens_servico(id), valor numeric, competencia text, vencimento date, status text DEFAULT 'a vencer', created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS financeiro_pagar ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, documento text, prestador_id uuid REFERENCES prestadores(id), valor numeric, competencia text, vencimento date, status text DEFAULT 'a vencer', created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS lancamentos_financeiros ( 
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, 
  data date, 
  descricao text, 
  categoria text, 
  tipo text, 
  valor numeric, 
  conta_contabil text, 
  unidade_id uuid REFERENCES unidades(id), 
  centro_custo_id uuid REFERENCES centros_custo(id), 
  realizado boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() 
);
CREATE TABLE IF NOT EXISTS saldos_financeiros ( 
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, 
  data date NOT NULL, 
  valor numeric NOT NULL, 
  created_at timestamp with time zone DEFAULT now() 
);
CREATE TABLE IF NOT EXISTS centros_resultado ( 
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, 
  nome text NOT NULL, 
  codigo text, 
  tipo text, 
  ativo boolean DEFAULT true, 
  created_at timestamp with time zone DEFAULT now() 
);

-- FISCAL
CREATE TABLE IF NOT EXISTS cte ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, os_id uuid REFERENCES ordens_servico(id), numero text, chave_acesso text, tomador_id uuid REFERENCES clientes(id), valor numeric, cfop text, data_emissao timestamp with time zone, status text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS mdfe ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, numero text, chave_acesso text, emissao timestamp with time zone, ufs_percurso text, encerrado boolean, status text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS nfse ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, faturamento_id uuid REFERENCES financeiro_receber(id), numero text, servico_codigo text, valor numeric, data_emissao timestamp with time zone, status text, created_at timestamp with time zone DEFAULT now() );

-- SISTEMA E AUDITORIA
CREATE TABLE IF NOT EXISTS notificacoes ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, user_id uuid REFERENCES usuarios(id), tipo text, mensagem text, lida boolean DEFAULT false, link_acao text, created_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS configuracoes ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, chave text UNIQUE, valor jsonb, updated_at timestamp with time zone DEFAULT now() );
CREATE TABLE IF NOT EXISTS activity_logs ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, user_id uuid REFERENCES usuarios(id), modulo text, acao text, detalhes jsonb, created_at timestamp with time zone DEFAULT now() );

-- ==========================================
-- 3. HABILITANDO REALTIME E RLS
-- ==========================================

-- Realtime nas Tabelas Operacionais
ALTER PUBLICATION supabase_realtime ADD TABLE ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE ocorrencias;
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;

-- RLS (Exemplo base)
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;

-- Exemplo: Policy p/ Cliente Visualizar Somente Suas Próprias OS (Simulando o Portal do Cliente)
CREATE POLICY view_own_os ON ordens_servico 
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM clientes WHERE id = ordens_servico.cliente_id)
        OR auth.uid() IN (SELECT id FROM usuarios WHERE perfil_id = (SELECT id FROM perfis WHERE nivel = 'admin'))
    );

-- ==========================================
-- 4. ÍNDICES DE ALTA PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_prestador ON ordens_servico(prestador_id);
CREATE INDEX IF NOT EXISTS idx_os_data ON ordens_servico(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_lida ON notificacoes(lida, user_id);
CREATE INDEX IF NOT EXISTS idx_receber_vencimento ON financeiro_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_pagar_vencimento ON financeiro_pagar(vencimento);

-- IA - ANÁLISE DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS documento_analises (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES prestadores(id),
  documento_id uuid REFERENCES provider_documents(id),
  veiculo_id uuid REFERENCES veiculos(id),
  tipo_doc text NOT NULL,
  arquivo_url text,
  dados_extraidos jsonb,
  divergencias jsonb,
  confianca_pct numeric,
  status_ia text DEFAULT 'pendente',
  status_final text DEFAULT 'pendente',
  aprovado_por uuid REFERENCES usuarios(id),
  motivo_rejeicao text,
  observacoes_ia text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analise_prestador ON documento_analises(prestador_id);
CREATE INDEX IF NOT EXISTS idx_analise_status_ia ON documento_analises(status_ia);
CREATE INDEX IF NOT EXISTS idx_analise_tipo ON documento_analises(tipo_doc);

-- RECRUTAMENTO INTELIGENTE
CREATE TABLE IF NOT EXISTS candidatos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome_completo text NOT NULL,
  cpf text,
  telefone text,
  whatsapp text,
  email text,
  cidade text,
  regiao text,
  tipo_veiculo text,
  tipo_carroceria text,
  placa text,
  experiencia_anos integer,
  como_conheceu text,
  mensagem_livre text,
  canal_captacao text DEFAULT 'link_direto',
  status text DEFAULT 'interessado',
  score_perfil numeric DEFAULT 0,
  prioridade numeric DEFAULT 0,
  ultima_interacao timestamp with time zone,
  prestador_id uuid REFERENCES prestadores(id),
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidato_documentos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  arquivo_url text,
  status text DEFAULT 'pendente',
  validade date,
  dados_extraidos jsonb,
  analise_ia_id uuid REFERENCES documento_analises(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidato_interacoes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  canal text DEFAULT 'sistema',
  mensagem text,
  resposta text,
  realizada_por text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homologacoes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,
  prestador_id uuid REFERENCES prestadores(id),
  status text DEFAULT 'pendente',
  checklist jsonb DEFAULT '{}',
  documentos_aprovados boolean DEFAULT false,
  dados_bancarios_conferidos boolean DEFAULT false,
  veiculo_compativel boolean DEFAULT false,
  contrato_gerado boolean DEFAULT false,
  app_instalado boolean DEFAULT false,
  treinamento_concluido boolean DEFAULT false,
  aprovado_por uuid REFERENCES usuarios(id),
  data_aprovacao timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservas_banco (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,
  tipo_veiculo text,
  regiao text,
  score_adequacao numeric DEFAULT 0,
  status text DEFAULT 'disponivel',
  ultima_proposta timestamp with time zone,
  total_propostas integer DEFAULT 0,
  aceitas integer DEFAULT 0,
  rejeitadas integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recrutamento_config (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  chave text UNIQUE,
  valor jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidatos_status ON candidatos(status);
CREATE INDEX IF NOT EXISTS idx_candidatos_regiao ON candidatos(regiao);
CREATE INDEX IF NOT EXISTS idx_candidatos_tipo_veiculo ON candidatos(tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_candidatos_score ON candidatos(score_perfil DESC);
CREATE INDEX IF NOT EXISTS idx_candidato_documentos_candidato ON candidato_documentos(candidato_id);
CREATE INDEX IF NOT EXISTS idx_candidato_interacoes_candidato ON candidato_interacoes(candidato_id);
CREATE INDEX IF NOT EXISTS idx_homologacoes_candidato ON homologacoes(candidato_id);
CREATE INDEX IF NOT EXISTS idx_reservas_banco_status ON reservas_banco(status);

-- COMUNICAÇÃO EM LOTE E ENGAJAMENTO
CREATE TABLE IF NOT EXISTS comunicacoes_lote (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo text NOT NULL,
  tipo text NOT NULL,
  conteudo text NOT NULL,
  canal_whatsapp boolean DEFAULT false,
  canal_push boolean DEFAULT false,
  canal_interno boolean DEFAULT false,
  conteudo_whatsapp text,
  titulo_push text,
  corpo_push text,
  icone_push text DEFAULT 'informativo',
  agendado_para timestamp with time zone,
  enviado boolean DEFAULT false,
  data_envio timestamp with time zone,
  recurrente boolean DEFAULT false,
  recorrencia_tipo text,
  recorrencia_dia_semana integer,
  recorrencia_dia_mes integer,
  reenviar_nao_visualizado boolean DEFAULT false,
  horas_para_reenvio1 integer DEFAULT 2,
  horas_para_reenvio2 integer DEFAULT 6,
  max_tentativas integer DEFAULT 2,
  hora_limite integer DEFAULT 22,
  filtros jsonb,
  criado_por uuid REFERENCES usuarios(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comunicacao_destinatarios (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  comunicacao_id uuid REFERENCES comunicacoes_lote(id) ON DELETE CASCADE,
  prestador_id uuid REFERENCES prestadores(id),
  candidato_id uuid REFERENCES candidatos(id),
  canal text NOT NULL,
  status text DEFAULT 'pendente',
  enviado_em timestamp with time zone,
  visualizado_em timestamp with time zone,
  respondido_em timestamp with time zone,
  resposta text,
  tentativa integer DEFAULT 1,
  erro text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comunicacao_templates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  categoria text NOT NULL,
  conteudo text NOT NULL,
  variaveis_suportadas jsonb,
  titulo_push text,
  corpo_push text,
  ativo boolean DEFAULT true,
  uso_count integer DEFAULT 0,
  performance_media numeric,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aniversarios_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES prestadores(id),
  candidato_id uuid REFERENCES candidatos(id),
  data_aniversario date NOT NULL,
  canal text NOT NULL,
  mensagem text,
  status text DEFAULT 'enviado',
  enviado_em timestamp with time zone DEFAULT now(),
  respondeu boolean DEFAULT false,
  resposta text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbox_mensagens (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  prestador_id uuid REFERENCES prestadores(id),
  candidato_id uuid REFERENCES candidatos(id),
  tipo text NOT NULL,
  canal text NOT NULL,
  direcao text NOT NULL,
  mensagem text NOT NULL,
  resposta text,
  ia_respondeu boolean DEFAULT false,
  lida boolean DEFAULT false,
  referencia_comunicacao_id uuid REFERENCES comunicacoes_lote(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campanhas_auto (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  ativa boolean DEFAULT true,
  filtros jsonb,
  mensagem text,
  agendamento_tipo text NOT NULL,
  agendamento_hora integer DEFAULT 8,
  agendamento_dia_semana integer,
  agendamento_dia_mes integer,
  ultima_execucao timestamp with time zone,
  total_execucoes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE inbox_mensagens;

CREATE INDEX IF NOT EXISTS idx_comunicacoes_enviado ON comunicacoes_lote(enviado);
CREATE INDEX IF NOT EXISTS idx_comunicacao_destinatarios_comunicacao ON comunicacao_destinatarios(comunicacao_id);
CREATE INDEX IF NOT EXISTS idx_comunicacao_destinatarios_prestador ON comunicacao_destinatarios(prestador_id);
CREATE INDEX IF NOT EXISTS idx_inbox_prestador ON inbox_mensagens(prestador_id);
CREATE INDEX IF NOT EXISTS idx_inbox_lida ON inbox_mensagens(lida, prestador_id);
CREATE INDEX IF NOT EXISTS idx_aniversarios_data ON aniversarios_log(data_aniversario);

-- Concluído.
