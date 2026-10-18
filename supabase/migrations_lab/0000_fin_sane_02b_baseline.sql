-- FIN-SANE-02B — Baseline Financeiro Minimo Isolado
-- Gerado automaticamente a partir das migrations oficiais
-- ZERO dados reais de producao

CREATE TABLE public.clientes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    razao_social text,
    nome_fantasia text,
    cnpj text,
    ie text,
    segmento text,
    porte text,
    status text DEFAULT 'ativo'::text,
    telefone text,
    whatsapp text,
    email text,
    contato_principal text,
    cidade text,
    uf text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    site text,
    responsavel_operacional text,
    responsavel_financeiro text,
    responsavel_comercial text,
    observacoes text,
    origem_comercial text,
    aceita_api bool DEFAULT false,
    aceita_portal bool DEFAULT false,
    exige_agendamento bool DEFAULT false,
    exige_sla bool DEFAULT false,
    exige_portal bool DEFAULT false,
    logo text,
    num_os_mes int4 DEFAULT 0,
    tipo_cobranca text,
    vencimento_padrao int4 DEFAULT 15,
    agrupamento_faturamento text,
    cte_obrigatorio bool DEFAULT false,
    xml_obrigatorio bool DEFAULT false,
    comprovante_obrigatorio bool DEFAULT false,
    canhoto_obrigatorio bool DEFAULT false,
    assinatura_legivel bool DEFAULT false,
    protocolo_obrigatorio bool DEFAULT false,
    geolocalizacao bool DEFAULT false,
    tomador text,
    cnae text,
    cfop_padrao text,
    retencoes text,
    envio_xml bool DEFAULT false,
    observacoes_fiscais text,
    municipio_padrao text,
    regime_tributario text,
    aliquota_iss numeric DEFAULT 0,
    incentivo_fiscal bool DEFAULT false,
    tabela_valores_padrao_id uuid,
    cep text,
    logradouro text,
    numero text,
    bairro text,
    complemento text,
    inscricao_municipal text,
    optante_simples bool DEFAULT false,
    tipo_frete_preferencial text DEFAULT 'rodoviario'::text,
    veiculo_preferencial text,
    horario_entrega_preferencial text,
    notificar_email bool DEFAULT true,
    notificar_whatsapp bool DEFAULT false,
    notificar_mudanca_status bool DEFAULT true,
    notificar_comprovante bool DEFAULT true,
    tenant_id uuid,
    PRIMARY KEY (id)
);

CREATE TABLE public.prestadores (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome_completo text,
    cpf_cnpj text,
    telefone text,
    whatsapp text,
    email text,
    tipo_parceiro text,
    status text DEFAULT 'ativo'::text,
    regiao_principal text,
    endereco jsonb,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    data_nascimento date,
    rg text,
    aceite_acordo bool DEFAULT false,
    score_interno numeric,
    status_operacional text,
    observacoes text,
    aceiteDoacordo bool DEFAULT false,
    aceita_dedicada bool DEFAULT false,
    aceita_urbana bool DEFAULT false,
    aceita_refrigerada bool DEFAULT false,
    aceita_esporadica bool DEFAULT false,
    conferend_manual bool DEFAULT false,
    aceita_refrigerado bool DEFAULT false,
    aceita_urbano bool DEFAULT false,
    aceita_dedicado bool DEFAULT false,
    conferencia_manual bool DEFAULT false,
    indice_comparecimento numeric DEFAULT 0,
    indice_entrega_prazo numeric DEFAULT 0,
    ultima_atualizacao timestamp DEFAULT now(),
    data_cadastro date,
    data_aprovacao date,
    ultimo_usuario text,
    observacoes_torre text,
    avaliacao_operacional text,
    indice_aceite numeric DEFAULT 0,
    qtd_operacoes int4 DEFAULT 0,
    foto text,
    regioes_secundarias _text,
    origem_cadastro text,
    indicacao text,
    disponibilidade_padrao text,
    turnos_preferenciais text,
    restricoes_operacionais text,
    aceita_viagem bool DEFAULT false,
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
    forma_preferencial text,
    conta_contabil text,
    centro_custo text,
    retencoes_descontos text,
    observacoes_financeiras text,
    rg_ie text,
    franquia_km numeric,
    forma_preferencial_pagamento text,
    retencoes text,
    rntrc text,
    antt text,
    auth_user_id uuid,
    origem text DEFAULT 'manual'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    liberado_app bool DEFAULT false,
    PRIMARY KEY (id)
);

CREATE TABLE public.ordens_servico (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    numero text,
    cliente uuid,
    prestador uuid,
    veiculo_alocado uuid,
    status text DEFAULT 'pendente'::text,
    data date,
    tipo_operacao text,
    carga_tipo text,
    peso numeric,
    volumes int4,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    adicionais jsonb,
    ajudante jsonb,
    cargaadicional jsonb,
    correios text,
    historico jsonb DEFAULT '[]'::jsonb,
    unidade text,
    centro_custo text,
    modalidade text,
    prioridade text,
    pedagio numeric,
    custo_prestador numeric,
    valor_cliente numeric,
    status_faturamento text,
    status_pagamento text,
    distancia_rota jsonb,
    enderecos jsonb DEFAULT '[]'::jsonb,
    carga_ajudante bool DEFAULT false,
    carga_refrigerada bool DEFAULT false,
    carga_fragil bool DEFAULT false,
    pallets numeric,
    cubagem numeric,
    valor_declarado numeric,
    carga_descricao text,
    veiculo_tipo text,
    veiculo_termica text,
    carga_empilhavel bool DEFAULT false,
    cliente_id text,
    prestador_id text,
    carga_refrigerado bool DEFAULT false,
    carga_risco bool DEFAULT false,
    frete_sugerido jsonb,
    ocorrencias jsonb DEFAULT '[]'::jsonb,
    documentos jsonb DEFAULT '[]'::jsonb,
    anexos jsonb DEFAULT '[]'::jsonb,
    carga_perigosa bool DEFAULT false,
    carga_controlada bool DEFAULT false,
    carga jsonb,
    tipo_veiculo text,
    data_servico timestamptz,
    centro_custo_inicio text,
    centro_custo_fim text,
    conta_contabil text,
    tabela_aplicada text,
    faturamento_status text DEFAULT 'A Faturar'::text,
    repasse_status text DEFAULT 'Pendente p/ ExtraÃ§Ã£o'::text,
    outros_custos_prev numeric DEFAULT 0,
    valor_prestador_calculado numeric DEFAULT 0,
    imposto_valor numeric DEFAULT 0,
    seguro_valor numeric DEFAULT 0,
    pedagio_valor numeric DEFAULT 0,
    outros_custos numeric DEFAULT 0,
    margem_bruta numeric DEFAULT 0,
    margem_liquida numeric DEFAULT 0,
    percentual_margem_liquida numeric DEFAULT 0,
    centro_custo_fin text,
    comprovante_obrigatorio bool DEFAULT false,
    cte_obrigatorio bool DEFAULT false,
    data_programada date,
    inicio_previsto timestamp,
    placa_alocada text,
    parceiro_id uuid,
    enviar_whatsapp bool DEFAULT false,
    forma_cobranca text,
    descontos numeric DEFAULT 0,
    email_destinatario text,
    nome_destinatario text,
    telefone_destinatario text,
    observacoes text,
    tipo_carga text,
    valor_total numeric DEFAULT 0,
    eventos_tracker jsonb DEFAULT '[]'::jsonb,
    faixa_aplicada text,
    distancia_km numeric DEFAULT 0,
    tempo_minutos numeric DEFAULT 0,
    valor_prestador numeric DEFAULT 0,
    margem numeric DEFAULT 0,
    origem text,
    destino text,
    desconto numeric DEFAULT 0,
    veiculo text,
    instrucoes_operacionais_os text,
    is_reserva bool DEFAULT false,
    xml_obrigatorio bool DEFAULT false,
    operacao_dedicada bool DEFAULT false,
    retorno_obrigatorio bool DEFAULT false,
    notificar_destinatario bool DEFAULT true,
    orcamento_origem text,
    veiculo_subcategoria text,
    veiculo_carroceria text,
    data_agendada text,
    observacao_agendamento text,
    janela_operacional text,
    previsao_inicio text,
    previsao_termino text,
    tipo_escala text,
    instrucoes_operacionais text,
    observacao_torre text,
    whatsapp_destinatario text,
    veiculo_sugerido text,
    recebedor_nome text,
    recebedor_documento text,
    reembolso_previsto numeric DEFAULT 0,
    lucro_estimado numeric DEFAULT 0,
    margem_lucro numeric DEFAULT 0,
    tempo_estimado numeric DEFAULT 0,
    localizacao_entrega_json jsonb,
    observacoes_gerais text,
    orcamento_id uuid,
    numero_orcamento text,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    tipo_reversa text DEFAULT 'sem_reversa'::text,
    reversa_qtd_volumes int4 DEFAULT 0,
    reversa_observacoes text,
    romaneio text,
    pedido_portal_id uuid,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alocacoes_escala (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Relacionamentos
    empresa_id uuid,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    prestador_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
    ordem_servico_id uuid,
    ordem_carregamento_id uuid,
    
    -- Dados operacionais
    data_escala date NOT NULL,
    turno text DEFAULT 'diurno',
    tipo_veiculo text,
    placa text,
    regiao text,
    rota text,
    origem text,
    destino text,
    
    -- Status e controle
    status text NOT NULL DEFAULT 'planejada' CHECK (
        status IN (
            'planejada', 
            'aguardando_aceite', 
            'aceita', 
            'recusada', 
            'em_rota', 
            'concluida', 
            'cancelada', 
            'ocorrencia'
        )
    ),
    status_pagamento text DEFAULT 'pendente' CHECK (
        status_pagamento IN ('pendente', 'aprovado', 'pago', 'cancelado')
    ),
    
    -- MÃ©tricas operacionais
    quantidade_entregas integer DEFAULT 0,
    quantidade_coletas integer DEFAULT 0,
    quantidade_paradas integer DEFAULT 0,
    km_previstos numeric DEFAULT 0,
    km_realizados numeric DEFAULT 0,
    
    -- Financeiro
    valor_frete numeric DEFAULT 0,
    valor_repasse numeric DEFAULT 0,
    valor_pedagio numeric DEFAULT 0,
    valor_combustivel numeric DEFAULT 0,
    valor_ajudante numeric DEFAULT 0,
    valor_adicional numeric DEFAULT 0,
    valor_desconto numeric DEFAULT 0,
    valor_total numeric GENERATED ALWAYS AS (
        valor_repasse + valor_pedagio + valor_combustivel + valor_ajudante + valor_adicional - valor_desconto
    ) STORED,
    
    -- Controles detalhados de valores (compatÃ­vel com EscalaLista.tsx)
    valor_tipo text DEFAULT 'fixo' CHECK (valor_tipo IN ('fixo', 'percentual')),
    valor_percentual numeric DEFAULT 0,
    valor_fixo numeric DEFAULT 0,
    combustivel_valor numeric DEFAULT 0,
    km_rodados numeric DEFAULT 0,
    valor_km numeric DEFAULT 0,
    pedagio_franquia numeric DEFAULT 0,
    pedagio_excedente numeric DEFAULT 0,
    pedagio_cobrar_excedente boolean DEFAULT false,
    diarias_adicionais integer DEFAULT 0,
    valor_diaria numeric DEFAULT 0,
    segunda_saida boolean DEFAULT false,
    valor_segunda_saida numeric DEFAULT 0,
    terceira_saida boolean DEFAULT false,
    valor_terceira_saida numeric DEFAULT 0,
    saidas_adicionais integer DEFAULT 0,
    valor_saida_adicional numeric DEFAULT 0,
    ajudantes integer DEFAULT 0,
    valor_ajudante_unit numeric DEFAULT 0,
    reembolsos_outros text,
    valor_reembolso_outros numeric DEFAULT 0,
    
    -- Tempos e horÃ¡rios
    horario_saida time,
    horario_retorno_previsto time,
    horario_inicio_real timestamptz,
    horario_fim_real timestamptz,
    tempo_total_minutos integer,
    
    -- App Prestador
    aceite_prestador boolean DEFAULT false,
    data_aceite timestamptz,
    motivo_recusa text,
    finalizada boolean DEFAULT false,
    data_finalizacao timestamptz,
    comprovante_url text,
    assinatura_url text,
    fotos_entrega text[], -- Array de URLs
    
    -- OcorrÃªncias e observaÃ§Ãµes
    ocorrencias_count integer DEFAULT 0,
    ocorrencias_descricao text,
    observacoes text,
    instrucoes_operacionais text,
    observacoes_internas text,
    
    -- InformaÃ§Ãµes de tabela de preÃ§os
    tabela_valores_id uuid,
    tem_regra_especial boolean DEFAULT false,
    
    -- Metadados e flexibilidade
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[],
    
    -- Auditoria
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

CREATE TABLE public.financeiro_receber (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    cliente_id uuid,
    descricao text,
    valor numeric,
    vencimento date,
    status text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    os_id text,
    cliente text,
    cliente_nome text,
    data_vencimento date,
    data_emissao date,
    data_pagamento date,
    categoria text,
    observacoes text,
    cliente_documento text,
    fatura text,
    serie text,
    numero text,
    os_vinculadas text,
    contrato_vinculado text,
    proposta_vinculada text,
    valor_bruto numeric DEFAULT 0,
    valor_liquido numeric DEFAULT 0,
    desconto numeric DEFAULT 0,
    juros numeric DEFAULT 0,
    multa numeric DEFAULT 0,
    abatimento numeric DEFAULT 0,
    data_previsao_recebimento date,
    recorrente bool DEFAULT false,
    quantidade_parcelas int4 DEFAULT 1,
    parcela_atual int4 DEFAULT 1,
    centro_resultado text,
    plano_conta text,
    conta_entrada text,
    recorrencia text DEFAULT 'nenhuma'::text,
    PRIMARY KEY (id)
);

CREATE TABLE public.financeiro_pagar (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    cliente_id uuid,
    descricao text,
    valor numeric,
    vencimento date,
    status text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    os_id text,
    prestador text,
    fornecedor_nome text,
    data_vencimento date,
    data_emissao date,
    data_pagamento date,
    categoria text,
    observacoes text,
    fornecedor_id uuid,
    fornecedor_documento text,
    fornecedor text,
    documento text,
    tipo_documento text DEFAULT 'NF'::text,
    os_vinculada text,
    valor_bruto numeric DEFAULT 0,
    valor_liquido numeric DEFAULT 0,
    desconto numeric DEFAULT 0,
    juros numeric DEFAULT 0,
    multa numeric DEFAULT 0,
    impostos_retidos numeric DEFAULT 0,
    data_previsao_pagamento date,
    conta_pagadora text DEFAULT 'Conta Corrente Principal'::text,
    codigo_barras text,
    chave_pix text,
    recorrente bool DEFAULT false,
    quantidade_parcelas int4 DEFAULT 1,
    parcela_atual int4 DEFAULT 1,
    competencia text,
    plano_contas text,
    centro_resultado text,
    unidade_filial text,
    despesa_fixa_base text DEFAULT 'VariÃ¡vel'::text,
    data_efetiva_pgto date,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS pagamentos_prestadores (
    -- PK
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Prestador
    prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
    prestador_nome text,
    prestador_documento text,

    -- Cliente
    cliente_id uuid,
    cliente_nome text,

    -- OS vinculada
    os_id uuid,
    os_numero text,

    -- Periodo de referencia
    periodo_inicio date,
    periodo_fim date,
    data_competencia date,
    competencia date,

    -- Datas de pagamento
    data_prevista_pagamento date,
    data_programada_pagamento date,
    data_pagamento date,

    -- ================================================================
    -- VALORES â€” multiplos sistemas de nomenclatura
    -- ================================================================

    -- Original sql_pagamentos_prestadores.sql
    quantidade_os integer DEFAULT 0,
    valor_servicos numeric(10,2) DEFAULT 0,
    valor_reembolsos numeric(10,2) DEFAULT 0,
    valor_bonus numeric(10,2) DEFAULT 0,
    valor_descontos numeric(10,2) DEFAULT 0,
    valor_adiantamentos numeric(10,2) DEFAULT 0,
    valor_liquido numeric(10,2) DEFAULT 0,

    -- Profissional (nomes com prefixo valor_)
    valor numeric(10,2) DEFAULT 0,
    valor_pedagio numeric(10,2) DEFAULT 0,
    valor_estacionamento numeric(10,2) DEFAULT 0,
    valor_combustivel numeric(10,2) DEFAULT 0,
    valor_adicionais numeric(10,2) DEFAULT 0,
    valor_multas numeric(10,2) DEFAULT 0,
    valor_ajustes numeric(10,2) DEFAULT 0,

    -- Fechamento (nomes sem prefixo)
    qtd_os integer DEFAULT 0,
    pedagio numeric DEFAULT 0,
    reembolsos numeric DEFAULT 0,
    adicionais numeric DEFAULT 0,
    descontos numeric DEFAULT 0,
    adiantamentos numeric DEFAULT 0,
    multas numeric DEFAULT 0,
    ajustes numeric DEFAULT 0,

    -- Dados bancarios
    banco text,
    agencia text,
    conta text,
    conta_tipo text,
    chave_pix text,

    -- Classificacao do lancamento
    tipo_lancamento text,
    natureza text DEFAULT 'credito',
    tipo_pagamento text,
    origem_lancamento text DEFAULT 'manual',
    categoria_financeira text,
    centro_custo text,
    conta_contabil text,

    -- Status
    status text DEFAULT 'pendente',
    status_conferencia text DEFAULT 'em_aberto',
    status_pagamento text DEFAULT 'pendente',
    status_aprovacao text DEFAULT 'aguardando_aprovacao',

    -- Forma de pagamento
    forma_pagamento text,
    conta_pagamento text,

    -- Observacoes
    observacao text,
    observacoes text,

    -- Arquivos / CNAB
    arquivo text,
    cnab_lote_id text,
    cnab_arquivo text,
    elegivel_lote boolean DEFAULT false,
    lote_id uuid,

    -- Impacto financeiro
    impacto_dre boolean DEFAULT true,
    impacto_fluxo_caixa boolean DEFAULT true,

    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_baixas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- VÃ­nculo polimÃ³rfico com o tÃ­tulo (sem FK fixa)
    titulo_tabela     TEXT NOT NULL,              -- 'financeiro_pagar' | 'financeiro_receber'
    titulo_id         UUID NOT NULL,

    -- Dados da baixa
    valor_original    NUMERIC(18,2) NOT NULL,     -- valor base do tÃ­tulo no momento da baixa
    valor_baixado     NUMERIC(18,2) NOT NULL,     -- valor pago nesta baixa
    saldo_restante    NUMERIC(18,2) NOT NULL,     -- saldo APÃ“S esta baixa (nunca negativo)

    -- Metadados
    data_baixa        DATE NOT NULL DEFAULT CURRENT_DATE,
    forma_pagamento   TEXT,                       -- 'pix','boleto','ted','dinheiro','cartao','compensacao',...
    conta_financeira  TEXT,                       -- conta/caixa utilizada (textual por ora; futura FK)
    referencia_bancaria TEXT,                     -- ID transaÃ§Ã£o / comprovante
    observacao        TEXT,

    -- UsuÃ¡rio que efetuou a baixa
    usuario_id        UUID,
    usuario_nome      TEXT,

    -- Estorno
    estornada         BOOLEAN NOT NULL DEFAULT false,
    data_estorno      TIMESTAMPTZ,
    motivo_estorno    TEXT,

    -- Auditoria
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_financeiro_baixas_tabela
      CHECK (titulo_tabela IN ('financeiro_pagar','financeiro_receber')),
    CONSTRAINT ck_financeiro_baixas_valor_baixado
      CHECK (valor_baixado > 0),
    CONSTRAINT ck_financeiro_baixas_saldo
      CHECK (valor_original >= 0 AND saldo_restante >= 0)
);

CREATE TABLE IF NOT EXISTS public.composicao_financeira_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid,
  cliente_id uuid,
  prestador_id uuid,
  valor_cliente numeric DEFAULT 0,
  valor_prestador numeric DEFAULT 0,
  imposto_percentual numeric DEFAULT 0,
  imposto_valor numeric DEFAULT 0,
  seguro_valor numeric DEFAULT 0,
  pedagio_valor numeric DEFAULT 0,
  outros_custos numeric DEFAULT 0,
  combustivel_valor numeric DEFAULT 0,
  ajudante_valor numeric DEFAULT 0,
  adicional_valor numeric DEFAULT 0,
  desconto_valor numeric DEFAULT 0,
  margem_bruta numeric DEFAULT 0,
  margem_liquida numeric DEFAULT 0,
  percentual_margem_bruta numeric DEFAULT 0,
  percentual_margem_liquida numeric DEFAULT 0,
  origem_calculo text DEFAULT 'trigger',
  tenant_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contas_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'Conta Corrente',
    banco TEXT,
    agencia TEXT,
    numero_conta TEXT,
    digito TEXT,
    titular TEXT,
    saldo NUMERIC(12,2) DEFAULT 0,
    saldo_inicial NUMERIC(12,2) DEFAULT 0,
    ativa BOOLEAN DEFAULT true,
    principal BOOLEAN DEFAULT false,
    empresa TEXT DEFAULT 'Matriz (SP)',
    plano_contas TEXT DEFAULT 'Disponibilidades',
    observacoes TEXT,
    cor TEXT DEFAULT '#2563eb',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas adicionadas por migrations entre M22 e FIN-SANE-02B
ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS valor_desconto_prestador NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_reversa TEXT DEFAULT 'sem_reversa',
  ADD COLUMN IF NOT EXISTS reversa_qtd_volumes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversa_valor_cliente NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversa_valor_prestador NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS fechamento_id UUID NULL;

-- Constraints UNIQUE(os_id) exigidas pelos triggers M66/M80
CREATE UNIQUE INDEX IF NOT EXISTS uq_fr_os_id ON public.financeiro_receber (os_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_os_id ON public.financeiro_pagar (os_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pp_os_id ON public.pagamentos_prestadores (os_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_composicao_os ON public.composicao_financeira_os (os_id);

-- Coluna exigida por f_confirmar_pagamento_prestador
ALTER TABLE public.financeiro_baixas ADD COLUMN IF NOT EXISTS conta_financeira_id UUID;

-- f_confirmar_pagamento_prestador (pre-02B)
-- FIN-362.3E - Confirmacao atomica e conciliada de pagamento de prestador.
-- Um pagamento so fica pago quando existe um titulo financeiro identificavel,
-- com valor integralmente conciliado e baixa persistida na mesma transacao.

CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_prestador(
    p_pagamento_id UUID,
    p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    sucesso BOOLEAN,
    mensagem TEXT,
    pagamento_id UUID,
    titulo_id UUID,
    baixa_id UUID,
    valor_pagamento NUMERIC,
    valor_liquidado NUMERIC,
    saldo_restante NUMERIC,
    conta_financeira_id UUID,
    conta_financeira TEXT,
    status_pagamento TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pagamento RECORD;
    v_titulo RECORD;
    v_conta RECORD;
    v_total_baixado NUMERIC(18,2);
    v_saldo NUMERIC(18,2);
    v_titulos INTEGER;
    v_baixa_id UUID;
    v_valor NUMERIC(18,2);
    v_data DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
BEGIN
    SELECT p.*
      INTO v_pagamento
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Pagamento de prestador nao encontrado.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    v_valor := ROUND(COALESCE(v_pagamento.valor_liquido, 0)::NUMERIC, 2);

    IF v_pagamento.status_pagamento = 'pago' OR v_pagamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Pagamento ja esta marcado como pago.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_pagamento.status_pagamento = 'cancelado' OR v_pagamento.status = 'cancelado' THEN
        RETURN QUERY SELECT false, 'Pagamento cancelado nao pode ser confirmado.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Pagamento possui valor liquido invalido.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    SELECT c.id, c.nome
      INTO v_conta
      FROM public.contas_financeiras c
     WHERE c.ativa = true
     ORDER BY c.principal DESC, c.nome ASC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Nenhuma conta financeira ativa esta configurada.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    -- OS vinculada: a conciliacao deve apontar para o titulo da mesma OS.
    -- Sem OS: somente um titulo de mesmo prestador E mesmo valor e aceito.
    IF v_pagamento.os_id IS NOT NULL THEN
        SELECT count(*)::INTEGER
          INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos <> 1 THEN
            RETURN QUERY SELECT false,
                CASE WHEN v_titulos = 0
                     THEN 'Nao existe titulo financeiro aberto, da mesma OS e com o mesmo valor do pagamento.'
                     ELSE 'Existe mais de um titulo candidato para a mesma OS; conciliacao ambigua.'
                END,
                v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
            RETURN;
        END IF;

        SELECT fp.*
          INTO v_titulo
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           )
         FOR UPDATE;
    ELSE
        SELECT count(*)::INTEGER
          INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos <> 1 THEN
            RETURN QUERY SELECT false,
                CASE WHEN v_titulos = 0
                     THEN 'Nao existe titulo financeiro aberto de mesma origem e mesmo valor.'
                     ELSE 'Existem varios titulos de mesmo prestador e valor; vinculo explicito e obrigatorio.'
                END,
                v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
            RETURN;
        END IF;

        SELECT fp.*
          INTO v_titulo
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           )
         FOR UPDATE;
    END IF;

    SELECT COALESCE(SUM(fb.valor_baixado), 0)::NUMERIC(18,2)
      INTO v_total_baixado
      FROM public.financeiro_baixas fb
     WHERE fb.titulo_tabela = 'financeiro_pagar'
       AND fb.titulo_id = v_titulo.id
       AND NOT COALESCE(fb.estornada, false);

    v_saldo := ROUND(COALESCE(v_titulo.valor, 0)::NUMERIC, 2) - v_total_baixado;

    IF v_saldo <> v_valor THEN
        RETURN QUERY SELECT false,
            'Saldo do titulo nao reconcilia integralmente com o pagamento; pagamento parcial nao e permitido neste fluxo.',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        observacao, estornada
    ) VALUES (
        'financeiro_pagar', v_titulo.id, v_valor, v_valor, 0,
        v_data, 'Pagamento Prestador', v_conta.nome, v_conta.id,
        'Baixa atomica - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8), false
    ) RETURNING id INTO v_baixa_id;

    UPDATE public.financeiro_pagar
       SET status = 'pago',
           data_pagamento = v_data,
           data_efetiva_pgto = v_data,
           conta_pagadora = v_conta.nome,
           observacoes = CASE
               WHEN observacoes IS NULL OR observacoes = '' THEN 'Baixa integral de pagamento de prestador.'
               ELSE observacoes || E'\nBaixa integral de pagamento de prestador.'
           END
     WHERE id = v_titulo.id;

    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = v_pagamento.id;

    RETURN QUERY SELECT true, 'Pagamento confirmado com baixa integral.',
        v_pagamento.id, v_titulo.id, v_baixa_id, v_valor, v_valor,
        0::NUMERIC, v_conta.id, v_conta.nome, 'pago'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f_confirmar_pagamento_prestador(uuid, date) TO service_role;

INSERT INTO public.contas_financeiras (id, nome, ativa, principal) VALUES (gen_random_uuid(), 'Conta Cora Lab', true, true);

