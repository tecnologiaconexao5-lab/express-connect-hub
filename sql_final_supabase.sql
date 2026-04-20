-- ============================================================
-- EXPRESS CONNECT HUB - SQL FINAL COMPLETO PARA SUPABASE
-- Executar este arquivo diretamente no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABELAS PRINCIPAIS
-- ============================================================

-- 1.1: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT NOT NULL UNIQUE,
    ie TEXT,
    segmento TEXT,
    porte TEXT,
    status TEXT DEFAULT 'Ativo',
    contato_principal TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    site TEXT,
    cidade TEXT,
    uf TEXT,
    logo TEXT,
    num_os_mes INTEGER DEFAULT 0,
    responsavel_operacional TEXT,
    responsavel_financeiro TEXT,
    responsavel_comercial TEXT,
    observacoes TEXT,
    origem_comercial TEXT,
    exige_agendamento BOOLEAN DEFAULT false,
    exige_sla BOOLEAN DEFAULT false,
    exige_portal BOOLEAN DEFAULT false,
    aceita_api BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2: enderecos_clientes
CREATE TABLE IF NOT EXISTS public.enderecos_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo TEXT,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    padrao BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3: veiculos
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa TEXT NOT NULL UNIQUE,
    tipo_veiculo TEXT NOT NULL,
    subcategoria TEXT,
    marca TEXT,
    modelo TEXT,
    ano_fabricacao INTEGER,
    ano_modelo INTEGER,
    cor TEXT,
    renavam TEXT,
    chassi TEXT,
    capacidade_kg NUMERIC(10,2),
    capacidade_m3 NUMERIC(10,2),
    comprimento NUMERIC(10,2),
    largura NUMERIC(10,2),
    altura NUMERIC(10,2),
    qtd_pallets INTEGER,
    tipo_carroceria TEXT,
    classificacao_termica TEXT,
    rastreador TEXT,
    seguro_apolice TEXT,
    validade_documental DATE,
    prestador_vinculado TEXT,
    unidade TEXT,
    custo_km NUMERIC(10,2),
    custo_diaria NUMERIC(10,2),
    status TEXT DEFAULT 'Ativo',
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4: prestadores
CREATE TABLE IF NOT EXISTS public.prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foto TEXT,
    nome_completo TEXT NOT NULL,
    nome_fantasia TEXT,
    cpf_cnpj TEXT NOT NULL UNIQUE,
    rg_ie TEXT,
    data_nascimento DATE,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    tipo_parceiro TEXT DEFAULT 'autonomo',
    status TEXT DEFAULT 'analise',
    endereco JSONB DEFAULT '{}',
    regiao_principal TEXT,
    regioes_secundarias TEXT[],
    origem_cadastro TEXT,
    indicacao TEXT,
    disponibilidade TEXT,
    turnos_preferenciais TEXT,
    restricoes_operacionais TEXT,
    aceita_refrigerada BOOLEAN DEFAULT false,
    aceita_urbana BOOLEAN DEFAULT false,
    aceita_dedicada BOOLEAN DEFAULT false,
    aceita_esporadica BOOLEAN DEFAULT false,
    contatos_emergencia JSONB DEFAULT '[]',
    documentos JSONB DEFAULT '[]',
    veiculos JSONB DEFAULT '[]',
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    digito TEXT,
    tipo_conta TEXT,
    favorecido TEXT,
    cpf_cnpj_favorecido TEXT,
    chave_pix TEXT,
    tipo_chave_pix TEXT,
    valor_diaria NUMERIC(10,2),
    valor_km NUMERIC(10,2),
    valor_saida NUMERIC(10,2),
    fixo_mensal NUMERIC(10,2),
    valor_ajudante NUMERIC(10,2),
    valor_espera NUMERIC(10,2),
    valor_reentrega NUMERIC(10,2),
    valor_devolucao NUMERIC(10,2),
    periodicidade_pagamento TEXT,
    prazo_pagamento TEXT,
    forma_preferencial_pagamento TEXT,
    conta_contabil TEXT,
    centro_custo TEXT,
    retencoes TEXT,
    conferenci_manual BOOLEAN DEFAULT false,
    observacoes_financeiras TEXT,
    score_interno NUMERIC(3,2) DEFAULT 0,
    avaliacao_operacional TEXT,
    qtd_operacoes INTEGER DEFAULT 0,
    indice_aceite NUMERIC(5,2) DEFAULT 0,
    indice_comparecimento NUMERIC(5,2) DEFAULT 0,
    indice_entrega_prazo NUMERIC(5,2) DEFAULT 0,
    historico_ocorrencias JSONB DEFAULT '[]',
    historico_bloqueios JSONB DEFAULT '[]',
    historico_alteracoes JSONB DEFAULT '[]',
    data_cadastro DATE,
    data_aprovacao DATE,
    ultima_atualizacao TIMESTAMPTZ,
    ultimo_usuario TEXT,
    observacoes_torre TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5: documentos_prestadores
CREATE TABLE IF NOT EXISTS public.documentos_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo TEXT,
    dados JSONB,
    validade DATE,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.6: veiculos_prestadores
CREATE TABLE IF NOT EXISTS public.veiculos_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
    veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    placa TEXT,
    tipo TEXT,
    capacidade_kg NUMERIC(10,2),
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7: ordens_servico
CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT NOT NULL UNIQUE,
    data DATE,
    cliente TEXT,
    unidade TEXT,
    centro_custo TEXT,
    orcamento_origem TEXT,
    prestador TEXT,
    veiculo_alocado TEXT,
    tipo_operacao TEXT,
    modalidade TEXT DEFAULT 'esporadico',
    prioridade TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'rascunho',
    responsavel TEXT,
    ref_cliente TEXT,
    pedido_interno TEXT,
    sla_operacao TEXT,
    observacoes_gerais TEXT,
    comprovante_obrigatorio BOOLEAN DEFAULT true,
    cte_obrigatorio BOOLEAN DEFAULT false,
    xml_obrigatorio BOOLEAN DEFAULT false,
    operacao_dedicada BOOLEAN DEFAULT false,
    carga_tipo TEXT,
    carga_descricao TEXT,
    volumes INTEGER DEFAULT 0,
    peso NUMERIC(10,2) DEFAULT 0,
    cubagem NUMERIC(10,2) DEFAULT 0,
    pallets INTEGER DEFAULT 0,
    valor_declarado NUMERIC(10,2) DEFAULT 0,
    qtd_notas INTEGER DEFAULT 0,
    carga_refrigerada BOOLEAN DEFAULT false,
    carga_ajudante BOOLEAN DEFAULT false,
    carga_fragil BOOLEAN DEFAULT false,
    carga_empilhavel BOOLEAN DEFAULT false,
    carga_risco BOOLEAN DEFAULT false,
    conferencia_obrigatoria BOOLEAN DEFAULT false,
    equipamento_obrigatorio TEXT,
    condicao_transporte TEXT,
    veiculo_tipo TEXT,
    veiculo_subcategoria TEXT,
    veiculo_carroceria TEXT,
    veiculo_termica TEXT DEFAULT 'seco',
    is_reserva BOOLEAN DEFAULT false,
    retorno_obrigatorio BOOLEAN DEFAULT false,
    data_programada DATE,
    janela_operacional TEXT,
    previsao_inicio TIMESTAMPTZ,
    previsao_termino TIMESTAMPTZ,
    tipo_escala TEXT,
    instrucoes_operacionais TEXT,
    observacao_torre TEXT,
    tabela_aplicada TEXT,
    valor_cliente NUMERIC(10,2) DEFAULT 0,
    custo_prestador NUMERIC(10,2) DEFAULT 0,
    pedagio NUMERIC(10,2) DEFAULT 0,
    ajudante NUMERIC(10,2) DEFAULT 0,
    adicionais NUMERIC(10,2) DEFAULT 0,
    descontos NUMERIC(10,2) DEFAULT 0,
    reembolso_previsto NUMERIC(10,2) DEFAULT 0,
    conta_contabil TEXT,
    centro_custo_fin TEXT,
    status_faturamento TEXT DEFAULT 'a faturar',
    status_pagamento TEXT DEFAULT 'a pagar',
    email_destinatario TEXT,
    whatsapp_destinatario TEXT,
    notificar_destinatario BOOLEAN DEFAULT true,
    eventos_tracker TEXT DEFAULT 'principais',
    enderecos JSONB DEFAULT '[]',
    historico JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.8: os_historico
CREATE TABLE IF NOT EXISTS public.os_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    acao TEXT NOT NULL,
    status_novo TEXT,
    usuario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9: ocorrencias
CREATE TABLE IF NOT EXISTS public.ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    descricao TEXT,
    severidade TEXT,
    status TEXT DEFAULT 'pendente',
    resolvida_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.10: financeiro_receber
CREATE TABLE IF NOT EXISTS public.financeiro_receber (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    cliente TEXT,
    descricao TEXT NOT NULL,
    valor NUMERIC(10,2) DEFAULT 0,
    vencimento DATE,
    data_vencimento DATE,
    data_emissao DATE,
    data_pagamento DATE,
    status TEXT DEFAULT 'aberto',
    categoria TEXT,
    plano_conta_id TEXT,
    centro_resultado_id TEXT,
    forma_recebimento TEXT,
    conta_financeira_id TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.11: financeiro_pagar
CREATE TABLE IF NOT EXISTS public.financeiro_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    prestador TEXT,
    descricao TEXT NOT NULL,
    valor NUMERIC(10,2) DEFAULT 0,
    vencimento DATE,
    data_vencimento DATE,
    data_emissao DATE,
    data_pagamento DATE,
    status TEXT DEFAULT 'aberto',
    categoria TEXT,
    plano_conta_id TEXT,
    centro_resultado_id TEXT,
    forma_pagamento TEXT,
    conta_pagadora_id TEXT,
    numero_boleto TEXT,
    codigo_barras TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.12: lancamentos_financeiros
CREATE TABLE IF NOT EXISTS public.lancamentos_financeiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL,
    categoria TEXT,
    descricao TEXT,
    valor NUMERIC(10,2) DEFAULT 0,
    data DATE,
    conta_id TEXT,
    plano_conta_id TEXT,
    centro_resultado_id TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.13: orcamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT NOT NULL UNIQUE,
    cliente TEXT NOT NULL,
    cliente_cnpj TEXT,
    unidade TEXT,
    centro_custo TEXT,
    responsavel TEXT,
    data_emissao DATE,
    validade DATE,
    tipo_operacao TEXT,
    modalidade TEXT DEFAULT 'esporadico',
    prioridade TEXT DEFAULT 'normal',
    pedido_interno TEXT,
    observacoes_gerais TEXT,
    status TEXT DEFAULT 'rascunho',
    carga JSONB DEFAULT '{}',
    veiculo JSONB DEFAULT '{}',
    valores JSONB DEFAULT '{}',
    historico JSONB DEFAULT '[]',
    motivo_reprovacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.14: orcamento_enderecos
CREATE TABLE IF NOT EXISTS public.orcamento_enderecos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    tipo TEXT,
    sequencia INTEGER,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    contato TEXT,
    telefone TEXT,
    instrucoes TEXT,
    janela_inicio TEXT,
    janela_fim TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.15: tabelas_valores
CREATE TABLE IF NOT EXISTS public.tabelas_valores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.16: cte
CREATE TABLE IF NOT EXISTS public.cte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT,
    serie TEXT,
    chave TEXT,
    data_emissao DATE,
    emitente TEXT,
    tomador TEXT,
    destinatario TEXT,
    valor NUMERIC(10,2),
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.17: mdfe
CREATE TABLE IF NOT EXISTS public.mdfe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT,
    chave TEXT,
    data DATE,
    emitente TEXT,
    valor NUMERIC(10,2),
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.18: nfse
CREATE TABLE IF NOT EXISTS public.nfse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT,
    serie TEXT,
    data_emissao DATE,
    prestador TEXT,
    tomador TEXT,
    valor NUMERIC(10,2),
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.19: candidatos
CREATE TABLE IF NOT EXISTS public.candidatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo TEXT NOT NULL,
    nome_fantasia TEXT,
    cpf_cnpj TEXT NOT NULL UNIQUE,
    rg_ie TEXT,
    data_nasc DATE,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    tipo_veiculo TEXT,
    regiao TEXT,
    status TEXT DEFAULT 'pendente',
    obs TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.20: homologacoes
CREATE TABLE IF NOT EXISTS public.homologacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
    data_homologacao DATE,
    status TEXT,
    obs TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.21: reservas_banco
CREATE TABLE IF NOT EXISTS public.reservas_banco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
    data_reserva DATE,
    status TEXT DEFAULT 'pendente',
    tipo_veiculo TEXT,
    regiao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.22: candidato_interacoes
CREATE TABLE IF NOT EXISTS public.candidato_interacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
    tipo TEXT,
    descricao TEXT,
    usuario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.23: documento_analises
CREATE TABLE IF NOT EXISTS public.documento_analises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo TEXT,
    dados JSONB,
    validade DATE,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.24: integration_logs
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servico TEXT NOT NULL,
    tipo TEXT,
    status TEXT,
    mensagem TEXT,
    erro TEXT,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.25: ia_logs
CREATE TABLE IF NOT EXISTS public.ia_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servico TEXT NOT NULL,
    tipo TEXT,
    modelo TEXT,
    input JSONB,
    output JSONB,
    tokens INTEGER,
    duracao_ms INTEGER,
    status TEXT,
    erro TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.26: activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario TEXT,
    acao TEXT NOT NULL,
    tabela TEXT,
    registro_id TEXT,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.27: comunicacao_templates
CREATE TABLE IF NOT EXISTS public.comunicacao_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    conteudo TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.28: inbox_mensagens
CREATE TABLE IF NOT EXISTS public.inbox_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remetente TEXT,
    destinatario TEXT,
    assunto TEXT,
    conteudo TEXT,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.29: combustivel_precos
CREATE TABLE IF NOT EXISTS public.combustivel_precos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_combustivel TEXT NOT NULL,
    preco NUMERIC(10,3) NOT NULL,
    posto TEXT,
    data DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_prestadores_cpf_cnpj ON public.prestadores(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_prestadores_status ON public.prestadores(status);
CREATE INDEX IF NOT EXISTS idx_prestadores_status_idx ON public.prestadores(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero ON public.ordens_servico(numero);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente ON public.ordens_servico(cliente);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero ON public.orcamentos(numero);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_vencimento ON public.financeiro_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_vencimento ON public.financeiro_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_data_emissao ON public.cte(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_mdfe_data ON public.mdfe(data DESC);
CREATE INDEX IF NOT EXISTS idx_nfse_data_emissao ON public.nfse(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_candidatos_status ON public.candidatos(status);
CREATE INDEX IF NOT EXISTS idx_candidatos_cpf ON public.candidatos(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_documento_analises_prestador ON public.documento_analises(prestador_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY E POLICIES
-- ============================================================

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdfe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidato_interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicacao_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combustivel_precos ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para todas as tabelas
CREATE POLICY "Allow all on clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on enderecos_clientes" ON public.enderecos_clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on veiculos" ON public.veiculos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on prestadores" ON public.prestadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documentos_prestadores" ON public.documentos_prestadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on veiculos_prestadores" ON public.veiculos_prestadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ordens_servico" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on os_historico" ON public.os_historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ocorrencias" ON public.ocorrencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on financeiro_receber" ON public.financeiro_receber FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on financeiro_pagar" ON public.financeiro_pagar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lancamentos_financeiros" ON public.lancamentos_financeiros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orcamentos" ON public.orcamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orcamento_enderecos" ON public.orcamento_enderecos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tabelas_valores" ON public.tabelas_valores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cte" ON public.cte FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on mdfe" ON public.mdfe FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on nfse" ON public.nfse FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on candidatos" ON public.candidatos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on homologacoes" ON public.homologacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reservas_banco" ON public.reservas_banco FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on candidato_interacoes" ON public.candidato_interacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on documento_analises" ON public.documento_analises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on integration_logs" ON public.integration_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ia_logs" ON public.ia_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on comunicacao_templates" ON public.comunicacao_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inbox_mensagens" ON public.inbox_mensagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on combustivel_precos" ON public.combustivel_precos FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. FUNCTIONS E TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_veiculos_updated_at BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prestadores_updated_at BEFORE UPDATE ON public.prestadores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ordens_servico_updated_at BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orcamentos_updated_at BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tabolas_valores_updated_at BEFORE UPDATE ON public.tabelas_valores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financeiro_receber_updated_at BEFORE UPDATE ON public.financeiro_receber FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financeiro_pagar_updated_at BEFORE UPDATE ON public.financeiro_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lancamentos_financeiros_updated_at BEFORE UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidatos_updated_at BEFORE UPDATE ON public.candidatos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reservas_banco_updated_at BEFORE UPDATE ON public.reservas_banco FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FIM DO SQL PRINCIPAL
-- ============================================================


-- ============================================================
-- B) BLOCO DE COMPATIBILIDADE CAMPOS CAMELCASE
-- Adicionar colunas camelCase para compatibilidade com frontend
-- ============================================================

-- Tabela: prestadores - Campos camelCase
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS nomeCompleto TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS nomeFantasia TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS cpfCnpj TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS rgIe TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS dataNascimento DATE;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS tipoParceiro TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS regiaoPrincipal TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS regioesSecundarias TEXT[];
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS origemCadastro TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS disponibilidade TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS turnosPreferenciais TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS restricoesOperacionais TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS aceitaRefrigerada BOOLEAN;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS aceitaUrbana BOOLEAN;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS aceitaDedicada BOOLEAN;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS aceitaEsporadica BOOLEAN;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS contatosEmergencia JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS documentos JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS veiculos JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorDiaria NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorKm NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorSaida NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS fixoMensal NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorAjudante NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorEspera NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorReentrega NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS valorDevolucao NUMERIC(10,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS periodicidadePagamento TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS prazoPagamento TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS formaPreferencialPagamento TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS contaContabil TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS centroCusto TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS conferenciManual BOOLEAN;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS observacoesFinanceiras TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS scoreInterno NUMERIC(3,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS avaliacaoOperacional TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS qtdOperacoes INTEGER;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS indiceAceite NUMERIC(5,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS indiceComparecimento NUMERIC(5,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS indiceEntregaPrazo NUMERIC(5,2);
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS historicoOcorrencias JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS historicoBloqueios JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS historicoAlteracoes JSONB;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS dataCadastro DATE;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS dataAprovacao DATE;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS ultimaAtualizacao TIMESTAMPTZ;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS ultimoUsuario TEXT;
ALTER TABLE public.prestadores ADD COLUMN IF NOT EXISTS observacoesTorre TEXT;

-- Tabela: veiculos - Campos camelCase
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS tipoVeiculo TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS subcategoria TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS anoFabricacao INTEGER;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS anoModelo INTEGER;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS capacidadeKg NUMERIC(10,2);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS capacidadeM3 NUMERIC(10,2);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS qtdPallets INTEGER;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS tipoCarroceria TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS classificacaoTermica TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS seguroApolice TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS validadeDocumental DATE;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS prestadorVinculado TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS custoKm NUMERIC(10,2);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS custoDiaria NUMERIC(10,2);

-- Tabela: ordens_servico - Campos camelCase
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculoAlocado TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipoOperacao TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS modalidade TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS prioridade TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS refCliente TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pedidoInterno TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS slaOperacao TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS observacoesGerais TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS comprovanteObrigatorio BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cteObrigatorio BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS xmlObrigatorio BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS operacaoDedicada BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaTipo TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaDescricao TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS volumes INTEGER;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS peso NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cubagem NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pallets INTEGER;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS valorDeclarado NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS qtdNotas INTEGER;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaRefrigerada BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaAjudante BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaFragil BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaEmpilhavel BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS cargaRisco BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS conferenciaObrigatoria BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS equipamentoObrigatorio TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS condicaoTransporte TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculoTipo TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculoSubcategoria TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculoCarroceria TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS veiculoTermica TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS isReserva BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS retornoObrigatorio BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS dataProgramada DATE;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS janelaOperacional TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS previsaoInicio TIMESTAMPTZ;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS previsaoTermino TIMESTAMPTZ;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipoEscala TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS instrucoesOperacionais TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS observacaoTorre TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tabelaAplicada TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS valorCliente NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS custoPrestador NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pedagio NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS adicionais NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS descontos NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS reembolsoPrevisto NUMERIC(10,2);
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS contaContabil TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS centroCustoFin TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS statusFaturamento TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS statusPagamento TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS emailDestinatario TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS whatsappDestinatario TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS notificarDestinatario BOOLEAN;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS eventosTracker TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS orcamentoOrigem TEXT;

-- Tabela: clientes - Campos camelCase
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS razaoSocial TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nomeFantasia TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricaoEstadual TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS contatoPrincipal TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numOsMes INTEGER;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS responsavelOperacional TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS responsavelFinanceiro TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS responsavelComercial TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS origemComercial TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS exigeAgendamento BOOLEAN;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS exigeSla BOOLEAN;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS exigePortal BOOLEAN;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS aceitaApi BOOLEAN;

-- Tabela: candidatos - Campos camelCase
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS nomeCompleto TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS nomeFantasia TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS cpfCnpj TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS rgIe TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS dataNasc DATE;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS tipoVeiculo TEXT;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS regiao TEXT;

-- Tabela: financeiro_receber - Campos camelCase
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS dataVencimento DATE;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS dataEmissao DATE;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS dataPagamento DATE;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS planoContaId TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS centroResultadoId TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS formaRecebimento TEXT;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS contaFinanceiraId TEXT;

-- Tabela: financeiro_pagar - Campos camelCase
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS dataVencimento DATE;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS dataEmissao DATE;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS dataPagamento DATE;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS planoContaId TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS centroResultadoId TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS formaPagamento TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS contaPagadoraId TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS numeroBoleto TEXT;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS codigoBarras TEXT;

-- Tabela: lancamentos_financeiros - Campos camelCase
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS contaId TEXT;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS planoContaId TEXT;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS centroResultadoId TEXT;

-- Tabela: orcamento_enderecos - Campos camelCase
ALTER TABLE public.orcamento_enderecos ADD COLUMN IF NOT EXISTS orcamentoId UUID;
ALTER TABLE public.orcamento_enderecos ADD COLUMN IF NOT EXISTS janelaInicio TEXT;
ALTER TABLE public.orcamento_enderecos ADD COLUMN IF NOT EXISTS janelaFim TEXT;

-- Tabela: cte - Campos camelCase
ALTER TABLE public.cte ADD COLUMN IF NOT EXISTS chave TEXT;
ALTER TABLE public.cte ADD COLUMN IF NOT EXISTS dataEmissao DATE;

-- Tabela: mdfe - Campos camelCase
ALTER TABLE public.mdfe ADD COLUMN IF NOT EXISTS chave TEXT;

-- Tabela: nfse - Campos camelCase
ALTER TABLE public.nfse ADD COLUMN IF NOT EXISTS dataEmissao DATE;

-- Tabela: documentao_analises - Campos camelCase
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS prestadorId UUID;
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS arquivo TEXT;
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS dados JSONB;
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS validade DATE;
ALTER TABLE public.documento_analises ADD COLUMN IF NOT EXISTS status TEXT;

-- Tabela: combustivel_precos - Campos camelCase
ALTER TABLE public.combustivel_precos ADD COLUMN IF NOT EXISTS tipoCombustivel TEXT;

-- Tabela: homologacoes - Campos camelCase
ALTER TABLE public.homologacoes ADD COLUMN IF NOT EXISTS candidatoId UUID;
ALTER TABLE public.homologacoes ADD COLUMN IF NOT EXISTS dataHomologacao DATE;

-- Tabela: reservas_banco - Campos camelCase
ALTER TABLE public.reservas_banco ADD COLUMN IF NOT EXISTS candidatoId UUID;
ALTER TABLE public.reservas_banco ADD COLUMN IF NOT EXISTS dataReserva DATE;
ALTER TABLE public.reservas_banco ADD COLUMN IF NOT EXISTS tipoVeiculo TEXT;

-- Tabela: candidate_interacoes - Campos camelCase
ALTER TABLE public.candidato_interacoes ADD COLUMN IF NOT EXISTS candidatoId UUID;
ALTER TABLE public.candidato_interacoes ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.candidato_interacoes ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.candidato_interacoes ADD COLUMN IF NOT EXISTS usuario TEXT;

-- ============================================================
-- FIM DO SQL COMPLETO
-- ============================================================