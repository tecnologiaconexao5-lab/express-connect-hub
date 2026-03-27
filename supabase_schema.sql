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
CREATE TABLE IF NOT EXISTS lancamentos_financeiros ( id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, data date, descricao text, categoria text, tipo text, valor numeric, conta_contabil text, created_at timestamp with time zone DEFAULT now() );

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

-- Concluído.
