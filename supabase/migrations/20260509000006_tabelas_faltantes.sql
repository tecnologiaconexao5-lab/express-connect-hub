-- ══════════════════════════════════════════════════════════════════════════════
-- MISSÃO — Inicialização Local: tabelas ausentes por timestamp inválido
-- Schemas extraídos da Produção em 2026-07-24 via pg (schema only, sem dados).
-- ATENÇÃO: Apenas estrutura. Sem INSERT, sem seeds, sem RLS, sem índices,
--          sem triggers, sem funções, sem realtime.
--          Objetos auxiliares (RLS, índices, realtime, triggers, funções)
--          estão nos arquivos .sql originais (a serem renomeados com timestamp).
--          Coluna tenant_id omitida em portal_tracking_realtime:
--          será adicionada quando current_tenant_id_safe() existir.
--          Tabelas operacoes/operacoes_financeiro/match_operacoes_prestadores
--          NÃO existem em Produção — omitidas.
--          FKs serão adicionadas pelos arquivos .sql originais.
-- ══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- contratos_modelos (FK de contratos_gerados, deve vir antes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contratos_modelos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL DEFAULT 'TAC'::text,
    conteudo_base text NOT NULL,
    variaveis text[] DEFAULT '{}'::text[],
    ativa boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- contratos_gerados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contratos_gerados (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    numero_contrato text,
    prestador_id uuid,
    modelo_id uuid,
    tipo_contrato text,
    contratado_nome text,
    conteudo_html text,
    pdf_url text,
    hash_documento text,
    status text DEFAULT 'aguardando'::text,
    aceite_whatsapp boolean DEFAULT false,
    aceite_whatsapp_data timestamp with time zone,
    aceite_whatsapp_numero text,
    aceite_whatsapp_mensagem text,
    assinatura_eletronica boolean DEFAULT false,
    assinatura_data timestamp with time zone,
    assinatura_ip text,
    assinatura_geolocalizacao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    valor_contrato numeric,
    valor_diaria numeric,
    valor_saida numeric,
    prestador_nome text,
    prestador_cpf text,
    prestador_cnpj text,
    prestador_rntrc text,
    prestador_telefone text,
    PRIMARY KEY (id)
);

-- FK contratos_gerados_modelo_id_fkey sera adicionado pelo
-- arquivo contratos_enterprise.sql original (quando renomeado)

-- ============================================================
-- contratos_historico
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contratos_historico (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contrato_id uuid,
    acao text NOT NULL,
    descricao text,
    dados jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- FK contratos_historico_contrato_id_fkey sera adicionado pelo
-- arquivo contratos_enterprise.sql original (quando renomeado)

-- ============================================================
-- portal_notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_notificacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    tipo text NOT NULL DEFAULT 'sistema'::text,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    canal text DEFAULT 'portal'::text,
    lida boolean DEFAULT false,
    prioridade text DEFAULT 'normal'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    referencia_id uuid,
    event_type text,
    prestador_id uuid,
    origem_id uuid,
    origem_tipo text,
    PRIMARY KEY (id)
);

-- FK sera adicionado pelo arquivo portal_cliente_enterprise.sql
-- original (quando renomeado)

-- ============================================================
-- portal_ocorrencias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_ocorrencias (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    tipo text NOT NULL DEFAULT 'outro'::text,
    descricao text,
    prioridade text DEFAULT 'media'::text,
    status text DEFAULT 'aberta'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- FK sera adicionado pelo arquivo portal_cliente_enterprise.sql
-- original (quando renomeado)

-- ============================================================
-- portal_avaliacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_avaliacoes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    nota integer NOT NULL,
    nps integer,
    comentario text,
    canal text DEFAULT 'portal'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_comprovantes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_comprovantes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    veiculo_id uuid,
    tipo text NOT NULL DEFAULT 'entrega'::text,
    titulo text NOT NULL,
    url text,
    nome_recebedor text,
    documento_recebedor text,
    data_entrega timestamp with time zone,
    latitude numeric,
    longitude numeric,
    fotos jsonb DEFAULT '[]'::jsonb,
    assinatura_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_protocolos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_protocolos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    comprovante_id uuid,
    protocolo text NOT NULL,
    status text DEFAULT 'pendente'::text,
    recebedor text,
    horario timestamp with time zone,
    localizacao jsonb DEFAULT '{}'::jsonb,
    eventos jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    parada_id uuid,
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_rotas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_rotas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    nome text NOT NULL,
    status text DEFAULT 'rascunho'::text,
    destinos jsonb DEFAULT '[]'::jsonb,
    veiculos_sugeridos jsonb DEFAULT '[]'::jsonb,
    km_estimado numeric DEFAULT 0,
    tempo_estimado_min integer DEFAULT 0,
    custo_estimado numeric DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_tracking_realtime
-- Coluna tenant_id omitida (será adicionada quando
-- current_tenant_id_safe() existir)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_tracking_realtime (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    veiculo_id uuid,
    status text DEFAULT 'offline'::text,
    latitude numeric,
    longitude numeric,
    eta_min integer,
    velocidade numeric,
    bateria numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    alocacao_id uuid,
    captured_at timestamp with time zone,
    precisao numeric,
    direcao numeric,
    created_at timestamp with time zone DEFAULT now(),
    origem text DEFAULT 'app_motorista'::text,
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_relatorios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_relatorios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    tipo text NOT NULL,
    titulo text NOT NULL,
    periodo_inicio date,
    periodo_fim date,
    url text,
    formato text DEFAULT 'csv'::text,
    filtros jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_faturas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_faturas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    numero text NOT NULL,
    competencia text NOT NULL,
    valor numeric DEFAULT 0,
    vencimento date,
    status text DEFAULT 'aberta'::text,
    url_boleto text,
    url_nf text,
    os_ids jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- portal_preferencias_cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portal_preferencias_cliente (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid,
    logo_url text,
    cor_primaria text DEFAULT '#F97316'::text,
    nome_exibicao text,
    notificacoes jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
    permissoes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (cliente_id)
);

-- ============================================================
-- orcamentos
-- ============================================================
-- ATENÇÃO: FKs e RLS serão adicionados por migrations posteriores.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cliente_id uuid,
    descricao text,
    valor_base numeric,
    valor_final numeric,
    distancia_rota jsonb,
    frete_sugerido jsonb,
    status text,
    endereco jsonb,
    carga jsonb,
    veiculo jsonb,
    valores jsonb,
    motivoreprovacao text,
    numero text,
    enderecos jsonb DEFAULT '[]'::jsonb,
    carga_ajudante boolean DEFAULT false,
    carga_refrigerado boolean DEFAULT false,
    carga_fragil boolean DEFAULT false,
    carga_pallets numeric,
    carga_cubagem numeric,
    carga_peso numeric,
    carga_volumes numeric,
    carga_valor_declarado numeric,
    carga_descricao text,
    veiculo_tipo text,
    pedagio numeric DEFAULT 0,
    adicionais numeric DEFAULT 0,
    descontos numeric DEFAULT 0,
    custo_estimado numeric DEFAULT 0,
    unidade text,
    centro_custo text,
    responsavel text,
    modalidade text,
    prioridade text,
    pedido_interno text,
    observacoes_gerais text,
    cliente_cnpj text,
    cliente text,
    data_emissao date,
    validade date,
    tipo_operacao text,
    carga_tipo text,
    carga_refrigerada boolean DEFAULT false,
    carga_empilhavel boolean DEFAULT false,
    carga_risco boolean DEFAULT false,
    veiculo_termica text,
    historico jsonb DEFAULT '[]'::jsonb,
    motivo_reprovacao text,
    carga_perigosa boolean DEFAULT false,
    carga_controlada boolean DEFAULT false,
    os_vinculada_id uuid,
    os_vinculada_numero text,
    PRIMARY KEY (id)
);

-- ===== TABELAS ADICIONAIS CRIADAS DIRETAMENTE EM PRODUCAO =====

-- ============================================================
-- documentos_prestadores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documentos_prestadores (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    prestador_id uuid,
    tipo text,
    url text,
    created_at timestamp without time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- campanhas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campanhas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome_campanha text NOT NULL,
    tipo_campanha text NOT NULL,
    objetivo text,
    canal text,
    publico_alvo text,
    orcamento_estimado numeric(12,2),
    data_inicio date,
    data_fim date,
    status text DEFAULT 'Rascunho'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- criativos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.criativos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    titulo text NOT NULL,
    tipo text NOT NULL,
    descricao text,
    link text,
    campanha_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- postagens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.postagens (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    data_planejada date,
    canal text,
    conteudo text,
    status text DEFAULT 'Rascunho'::text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    telefone text,
    email text,
    empresa text,
    origem text,
    campanha_id uuid,
    tipo_lead text NOT NULL,
    status text DEFAULT 'Novo'::text,
    responsavel text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- composicao_financeira
-- ============================================================
CREATE TABLE IF NOT EXISTS public.composicao_financeira (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    os_id uuid,
    valor_cliente numeric,
    valor_prestador numeric,
    impostos numeric DEFAULT 0,
    seguro numeric DEFAULT 0,
    pedagio numeric DEFAULT 0,
    outros numeric DEFAULT 0,
    margem_bruta numeric,
    margem_liquida numeric,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- os_historico
-- ============================================================
CREATE TABLE IF NOT EXISTS public.os_historico (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    ordem_servico_id uuid,
    descricao text,
    created_at timestamp without time zone DEFAULT now(),
    acao text,
    status_novo text,
    usuario text,
    os_id uuid,
    PRIMARY KEY (id)
);

-- ============================================================
-- os_ocorrencias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.os_ocorrencias (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ordem_servico_id uuid NOT NULL,
    prestador_id uuid,
    tipo text,
    descricao text,
    created_at timestamp without time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- os_pod
-- ============================================================
CREATE TABLE IF NOT EXISTS public.os_pod (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ordem_servico_id uuid NOT NULL,
    prestador_id uuid,
    nome_recebedor text,
    grau_proximidade text,
    documento_recebedor text,
    observacao text,
    foto_url text,
    created_at timestamp without time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- ocorrencias (tenant_id omitido)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ocorrencias (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    os_id uuid,
    alocacao_id uuid,
    prestador_id uuid,
    prestador text,
    cliente_id uuid,
    tipo text NOT NULL,
    descricao text,
    status text DEFAULT 'pendente'::text,
    severidade text DEFAULT 'media'::text,
    prioridade text DEFAULT 'normal'::text,
    visivel_cliente boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    evidencias jsonb DEFAULT '[]'::jsonb,
    resolvida_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- unidades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.unidades (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    status text DEFAULT 'Ativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- filiais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.filiais (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    status text DEFAULT 'Ativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- regioes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regioes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    status text DEFAULT 'Ativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- centros_custo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.centros_custo (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    status text DEFAULT 'Ativo'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================
-- rota_paradas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rota_paradas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    rota_id uuid,
    sequencia integer NOT NULL,
    cliente_nome text,
    telefone text,
    cep text,
    endereco text,
    numero text,
    bairro text,
    cidade text,
    uf text,
    complemento text,
    latitude numeric,
    longitude numeric,
    peso numeric DEFAULT 0,
    volumes integer DEFAULT 0,
    cubagem numeric DEFAULT 0,
    temperatura text,
    prioridade text DEFAULT 'normal'::text,
    janela_entrega text,
    observacoes text,
    status text DEFAULT 'pendente'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    os_id uuid,
    alocacao_id uuid,
    pedido text,
    nota_fiscal text,
    destinatario text,
    contato text,
    tipo_carga text,
    instrucoes text,
    recebedor text,
    assinatura_url text,
    pod_url text,
    fotos jsonb DEFAULT '[]'::jsonb,
    ocorrencia text,
    data_hora timestamp with time zone,
    latitude_fim numeric,
    longitude_fim numeric,
    data_entrega timestamp with time zone,
    volumes_entregues integer DEFAULT 0,
    logradouro text,
    referencia text,
    contato_nome text,
    contato_telefone text,
    responsavel_local text,
    recebedor_previsto text,
    horario_limite text,
    portaria text,
    doca text,
    procedimento_entrada text,
    procedimento_saida text,
    estacionamento text,
    documento_necessario text,
    codigo_acesso text,
    temperatura_carga text,
    exigencia_epi boolean DEFAULT false,
    exige_ajudante boolean DEFAULT false,
    restricao_veiculo text,
    restricao_altura text,
    outras_restricoes text,
    data_prevista date,
    PRIMARY KEY (id)
);

-- ============================================================
-- rotas (tenant_id omitido)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rotas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    status text DEFAULT 'rascunho'::text,
    data_rota date,
    tipo_rota text DEFAULT 'entrega'::text,
    distancia_km numeric DEFAULT 0,
    duracao_min numeric DEFAULT 0,
    peso_total numeric DEFAULT 0,
    volumes_total integer DEFAULT 0,
    veiculo_sugerido text,
    prestador_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    os_id uuid,
    cliente_id uuid,
    motorista text,
    veiculo text,
    horario_previsto timestamp with time zone,
    horario_realizado timestamp with time zone,
    sla text,
    destino_final text,
    numero_paradas integer DEFAULT 0,
    paradas_pendentes integer DEFAULT 0,
    operation_mode text DEFAULT 'standard_delivery'::text,
    instrucoes text,
    alocacao_id uuid,
    PRIMARY KEY (id)
);
