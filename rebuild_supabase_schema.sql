-- Migração de Setup Completo do Banco de Dados - V2 (Rebuild Total Baseado no Frontend)
-- Sistema: Conexão Express Transportes
-- Módulos: Usuários, Administrativo, Comercial, Operacional, Financeiro, Fiscal, CRM

-- ==========================================
-- 1. HABILITAR EXTENSÕES E FUNÇÕES
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger function para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- 2. CRIAÇÃO DE TABELAS DE DOMÍNIOS E CADASTRO BASE
-- ==========================================

CREATE TABLE IF NOT EXISTS regioes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS filiais (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text,
    cnpj text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unidades (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    filial_id uuid REFERENCES filiais(id),
    nome text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS centros_custo (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text,
    codigo text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfis (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text,
    nivel text,
    permissoes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id uuid NOT NULL PRIMARY KEY, -- REFERENCIA A AUTH.USERS no supabase se preferir
    perfil_id uuid REFERENCES perfis(id),
    unidade_id uuid REFERENCES unidades(id),
    nome text,
    email text,
    status text DEFAULT 'ativo',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 3. CLIENTES 
-- ==========================================

CREATE TABLE IF NOT EXISTS clientes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Dados Cadastrais
    razao_social text NOT NULL,
    nome_fantasia text,
    cnpj text NOT NULL,
    ie text,
    segmento text,
    porte text,
    status text DEFAULT 'ativo',
    logo text,
    
    -- Contatos
    contato_principal text,
    telefone text,
    whatsapp text,
    email text,
    site text,
    
    -- Endereco Principal
    cidade text,
    uf text,
    
    -- Operações e Regras
    num_os_mes integer,
    responsavel_operacional text,
    responsavel_financeiro text,
    responsavel_comercial text,
    observacoes text,
    origem_comercial text,
    
    -- Flags
    exige_agendamento boolean DEFAULT false,
    exige_sla boolean DEFAULT false,
    exige_portal boolean DEFAULT false,
    aceita_api boolean DEFAULT false,
    
    user_id uuid REFERENCES usuarios(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_addresses (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    tipo text,
    nome text,
    cep text,
    logradouro text, -- Rua
    numero text,
    complemento text,
    bairro text,
    cidade text,
    uf text, -- Estado
    referencia text,
    padrao boolean DEFAULT false,
    
    -- Contato Local
    contato_local text,
    telefone_local text,
    
    -- Instruções Operacionais
    instrucoes text,
    janela_padrao text,
    restricoes text,
    agendamento boolean DEFAULT false,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_contacts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    nome text,
    cargo text,
    telefone text,
    email text,
    principal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_commercial_rules (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    prazo_pagamento text,
    tabela_aplicavel_id uuid,
    limite_credito numeric,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tabelas_valores (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    base_calculo text,
    status text,
    tipo_cobranca text,
    vigencia_fim date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_table_rules (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tabela_id uuid REFERENCES tabelas_valores(id) ON DELETE CASCADE,
    uf_origem text,
    uf_destino text,
    valor_base numeric,
    valor_kg_excedente numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_table_additionals (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tabela_id uuid REFERENCES tabelas_valores(id) ON DELETE CASCADE,
    tipo_adicional text,
    taxa_fixa numeric,
    percentual numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 4. PRESTADORES
-- ==========================================

CREATE TABLE IF NOT EXISTS prestadores (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    foto text,
    nome_razao text, -- from nomeCompleto / nome_razao
    nome_fantasia text,
    cpf_cnpj text NOT NULL,
    rg_ie text,
    data_nascimento date,
    tipo_parceiro text,
    status text DEFAULT 'ativo',
    telefone text,
    whatsapp text,
    email text,
    
    -- Endereço
    endereco_cep text,
    endereco_rua text,
    endereco_numero text,
    endereco_complemento text,
    endereco_bairro text,
    endereco_cidade text,
    endereco_estado text,
    
    -- Operacional / Geográfico
    regiao_principal text,
    regioes_secundarias jsonb,
    origem_cadastro text,
    indicacao text,
    disponibilidade text,
    turnos_preferenciais text,
    restricoes_operacionais text,
    aceita_refrigerada boolean DEFAULT false,
    aceita_urbana boolean DEFAULT true,
    aceita_dedicada boolean DEFAULT true,
    aceita_esporadica boolean DEFAULT true,
    
    -- Financeiro (Bancos e Regras)
    banco text,
    agencia text,
    conta text,
    digito text,
    tipo_conta text,
    favorecido text,
    cpf_cnpj_favorecido text,
    chave_pix text,
    tipo_chave_pix text,
    valor_diaria numeric,
    valor_km numeric,
    valor_saida numeric,
    fixo_mensal numeric,
    valor_ajudante numeric,
    valor_espera numeric,
    valor_reentrega numeric,
    valor_devolucao numeric,
    periodicidade_pagamento text,
    prazo_pagamento text,
    forma_preferencial_pagamento text,
    conta_contabil text,
    centro_custo text,
    retencoes text,
    conferencia_manual boolean DEFAULT false,
    observacoes_financeiras text,
    
    -- Dashboard / Historico
    score numeric DEFAULT 0,
    avaliacao_operacional text,
    qtd_operacoes integer DEFAULT 0,
    indice_aceite numeric DEFAULT 0,
    indice_comparecimento numeric DEFAULT 0,
    indice_entrega_no_prazo numeric DEFAULT 0,
    observacoes_torre text,
    
    -- Auditoria de Registro
    data_cadastro date,
    data_aprovacao date,
    ultima_atualizacao date,
    ultimo_usuario text,
    
    user_id uuid REFERENCES usuarios(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
    tipo text,
    url text,
    validade date,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_emergency_contacts (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
    nome text,
    relacao text, -- formerly parentesco
    telefone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. VEÍCULOS
-- ==========================================

CREATE TABLE IF NOT EXISTS veiculos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
    unidade_id uuid REFERENCES unidades(id),
    
    placa text NOT NULL,
    tipo text, -- tipo_veiculo
    subcategoria text,
    marca text,
    modelo text,
    ano_fabricacao integer,
    ano_modelo integer,
    cor text,
    renavam text,
    chassi text,
    
    -- Capacidade e Dimensões
    capacidade_kg numeric,
    capacidade_m3 numeric,
    comprimento numeric,
    largura numeric,
    altura numeric,
    qtd_pallets integer,
    tipo_carroceria text,
    
    -- Adicionais / Seguros
    termico boolean DEFAULT false,
    classificacao_termica text,
    rastreador text,
    seguro_apolice text,
    validade_documental date,
    
    -- Financeiro (por Veículo se diferenciado)
    custo_km numeric,
    custo_diaria numeric,
    
    status text DEFAULT 'ativo',
    observacoes text,
    fotos jsonb,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    veiculo_id uuid REFERENCES veiculos(id) ON DELETE CASCADE,
    tipo text,
    url text,
    validade date,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 6. CONTRATOS (General)
-- ==========================================

CREATE TABLE IF NOT EXISTS contratos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE SET NULL,
    numero text,
    tipo text,
    vigencia_inicio date,
    vigencia_fim date,
    reajuste text,
    status text,
    arquivo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 7. ORÇAMENTOS & CRM
-- ==========================================

CREATE TABLE IF NOT EXISTS orcamentos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    numero text,
    cliente_id uuid REFERENCES clientes(id),
    valor_total numeric,
    status text DEFAULT 'rascunho',
    filial_origem text,
    vigencia date,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orcamento_enderecos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
    tipo text,
    cep text,
    cidade text,
    uf text,
    valor_trecho numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_oportunidades (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    titulo text,
    valor_estimado numeric,
    estagio text,
    fechamento_esperado date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 8. OPERACIONAL (ORDENS DE SERVIÇO)
-- ==========================================

CREATE TABLE IF NOT EXISTS ordens_servico (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    numero text NOT NULL,
    cliente_id uuid REFERENCES clientes(id),
    unidade_id uuid REFERENCES unidades(id),
    centro_custo_id uuid REFERENCES centros_custo(id),
    orcamento_id uuid REFERENCES orcamentos(id),
    prestador_id uuid REFERENCES prestadores(id),
    veiculo_id uuid REFERENCES veiculos(id),
    
    -- Infos Principais
    tipo_operacao text,
    modalidade text,
    prioridade text,
    status text DEFAULT 'rascunho',
    responsavel text,
    ref_cliente text,
    pedido_interno text,
    sla_operacao text,
    observacoes_gerais text,
    
    -- Flags da OS
    comprovante_obrigatorio boolean DEFAULT false,
    cte_obrigatorio boolean DEFAULT false,
    xml_obrigatorio boolean DEFAULT false,
    operacao_dedicada boolean DEFAULT false,
    
    -- Carga
    carga_tipo text,
    carga_descricao text,
    volumes integer,
    peso numeric,
    cubagem numeric,
    pallets integer,
    valor_declarado numeric,
    qtd_notas integer,
    carga_refrigerada boolean DEFAULT false,
    carga_ajudante boolean DEFAULT false,
    carga_fragil boolean DEFAULT false,
    carga_empilhavel boolean DEFAULT false,
    carga_risco boolean DEFAULT false,
    conferencia_obrigatoria boolean DEFAULT false,
    equipamento_obrigatorio text,
    condicao_transporte text,

    -- Exigências para Veículo da OS
    veiculo_tipo text,
    veiculo_subcategoria text,
    veiculo_carroceria text,
    veiculo_termica text,
    is_reserva boolean DEFAULT false,
    retorno_obrigatorio boolean DEFAULT false,

    -- Programação
    data_previsao timestamp with time zone,
    data_programada date,
    janela_operacional text,
    previsao_inicio timestamp with time zone,
    previsao_termino timestamp with time zone,
    tipo_escala text,
    instrucoes_operacionais text,
    observacao_torre text,

    -- Financeiro (OS)
    tabela_aplicada text,
    valor_frete numeric,  -- or valor_cliente
    custo_prestador numeric,
    pedagio numeric DEFAULT 0,
    ajudante numeric DEFAULT 0,
    adicionais numeric DEFAULT 0,
    descontos numeric DEFAULT 0,
    reembolso_previsto numeric DEFAULT 0,
    conta_contabil text,
    centro_custo_fin text,
    status_faturamento text DEFAULT 'a faturar',
    status_pagamento text DEFAULT 'a pagar',

    -- Destinatário Informações (Push/Email)
    email_destinatario text,
    whatsapp_destinatario text,
    notificar_destinatario boolean DEFAULT false,
    eventos_tracker jsonb,

    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS os_enderecos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    os_id uuid REFERENCES ordens_servico(id) ON DELETE CASCADE,
    tipo text,
    sequencia integer,
    cep text,
    nome_local text,
    endereco text, -- logradouro e numero combinados base frontend
    referencia text,
    instrucoes text,
    contato text,
    telefone text,
    janela_inicio text,
    janela_fim text,
    tempo_sla text,
    restricoes text,
    agendamento boolean DEFAULT false,
    status_ponto text DEFAULT 'pendente',
    observacoes text,
    assinatura_base64 text,
    recebedor text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS os_historico (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    os_id uuid REFERENCES ordens_servico(id) ON DELETE CASCADE,
    acao text,
    status_novo text,
    observacao text,
    usuario_id uuid REFERENCES usuarios(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS os_documentos (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    os_id uuid REFERENCES ordens_servico(id) ON DELETE CASCADE,
    tipo text,
    url text,
    uploaded_by uuid REFERENCES usuarios(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ocorrencias (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    os_id uuid REFERENCES ordens_servico(id) ON DELETE CASCADE,
    tipo text,
    descricao text,
    severidade text,
    status text,
    resolvida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 9. FINANCEIRO
-- ==========================================

CREATE TABLE IF NOT EXISTS financeiro_receber (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    fatura text,
    cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
    os_id uuid REFERENCES ordens_servico(id),
    valor numeric,
    competencia text,
    vencimento date,
    status text DEFAULT 'a vencer',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financeiro_pagar (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    documento text,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
    valor numeric,
    competencia text,
    vencimento date,
    status text DEFAULT 'a vencer',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saldos_financeiros (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    data date NOT NULL,
    valor numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS centros_resultado (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    nome text NOT NULL,
    codigo text,
    tipo text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 10. FISCAL
-- ==========================================

CREATE TABLE IF NOT EXISTS cte (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    os_id uuid REFERENCES ordens_servico(id),
    numero text,
    chave_acesso text,
    tomador_id uuid REFERENCES clientes(id),
    valor numeric,
    cfop text,
    data_emissao timestamp with time zone,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mdfe (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    numero text,
    chave_acesso text,
    emissao timestamp with time zone,
    ufs_percurso text,
    encerrado boolean,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nfse (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    faturamento_id uuid REFERENCES financeiro_receber(id),
    numero text,
    servico_codigo text,
    valor numeric,
    data_emissao timestamp with time zone,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 11. SISTEMA E AUDITORIA (Exclui Recrutamento Temporário, foco Core)
-- ==========================================

CREATE TABLE IF NOT EXISTS notificacoes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES usuarios(id),
    tipo text,
    mensagem text,
    lida boolean DEFAULT false,
    link_acao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracoes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    chave text UNIQUE,
    valor jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES usuarios(id),
    modulo text,
    acao text,
    detalhes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- Tabela IA, Documentos para não perder funcionalidade
-- ==========================================
CREATE TABLE IF NOT EXISTS documento_analises (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- RECRUTAMENTO INTELIGENTE
-- ==========================================
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidato_interacoes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  canal text DEFAULT 'sistema',
  mensagem text,
  resposta text,
  realizada_por text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
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
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recrutamento_config (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  chave text UNIQUE,
  valor jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);


-- ==========================================
-- 12. TRIGGERS AUTOMÁTICOS
-- ==========================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 13. ÍNDICES DE ALTA PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_os_numero ON ordens_servico(numero);
CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_prestador ON ordens_servico(prestador_id);
CREATE INDEX IF NOT EXISTS idx_os_data ON ordens_servico(created_at);

CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_prestadores_cnpj ON prestadores(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);

CREATE INDEX IF NOT EXISTS idx_notif_lida ON notificacoes(lida, user_id);
CREATE INDEX IF NOT EXISTS idx_receber_vencimento ON financeiro_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_pagar_vencimento ON financeiro_pagar(vencimento);

-- Concluído.
