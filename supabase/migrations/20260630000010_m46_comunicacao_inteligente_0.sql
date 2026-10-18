-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 46 — CENTRAL DE COMUNICAÇÃO INTELIGENTE
-- Tabelas: communication_templates, communication_events,
--          communication_preferences, tracking_public_links
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0. Função auxiliar para tenant_id
CREATE OR REPLACE FUNCTION public.current_tenant_id_safe()
RETURNS uuid AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant_id', true)::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. communication_templates — templates de mensagem
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid DEFAULT public.current_tenant_id_safe(),
    codigo          text NOT NULL,
    nome            text NOT NULL,
    canal           text DEFAULT 'todos',
    publico         text NOT NULL CHECK (publico IN ('destinatario', 'cliente', 'prestador')),
    evento          text NOT NULL,
    assunto         text,
    corpo           text NOT NULL,
    variaveis       jsonb DEFAULT '[]'::jsonb,
    branding        jsonb DEFAULT '{}'::jsonb,
    ativo           boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE(tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_ct_templates_codigo ON public.communication_templates(codigo);
CREATE INDEX IF NOT EXISTS idx_ct_templates_publico ON public.communication_templates(publico);
CREATE INDEX IF NOT EXISTS idx_ct_templates_evento ON public.communication_templates(evento);
CREATE INDEX IF NOT EXISTS idx_ct_templates_ativo ON public.communication_templates(ativo);

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct_templates_select_tenant" ON public.communication_templates;
CREATE POLICY "ct_templates_select_tenant" ON public.communication_templates
    FOR SELECT TO anon, authenticated
    USING (tenant_id = public.current_tenant_id_safe());

DROP POLICY IF EXISTS "ct_templates_insert_tenant" ON public.communication_templates;
CREATE POLICY "ct_templates_insert_tenant" ON public.communication_templates
    FOR INSERT TO anon, authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. communication_events — eventos de comunicação gerados
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communication_events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid DEFAULT public.current_tenant_id_safe(),
    os_id               uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    alocacao_id         uuid REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL,
    cliente_id          uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    prestador_id        uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
    template_id         uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
    destinatario_nome   text,
    destinatario_contato text,
    evento              text NOT NULL,
    publico             text NOT NULL CHECK (publico IN ('destinatario', 'cliente', 'prestador')),
    canal               text DEFAULT 'simulation',
    status_envio        text DEFAULT 'pendente' CHECK (status_envio IN ('pendente', 'enviado', 'falhou', 'cancelado', 'simulado')),
    assunto             text,
    mensagem            text,
    payload             jsonb DEFAULT '{}'::jsonb,
    erro                text,
    scheduled_at        timestamptz,
    sent_at             timestamptz,
    created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ce_events_os_id ON public.communication_events(os_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_alocacao_id ON public.communication_events(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_cliente_id ON public.communication_events(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_evento ON public.communication_events(evento);
CREATE INDEX IF NOT EXISTS idx_ce_events_status ON public.communication_events(status_envio);
CREATE INDEX IF NOT EXISTS idx_ce_events_created_at ON public.communication_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ce_events_publico ON public.communication_events(publico);

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ce_events_select_tenant" ON public.communication_events;
CREATE POLICY "ce_events_select_tenant" ON public.communication_events
    FOR SELECT TO anon, authenticated
    USING (tenant_id = public.current_tenant_id_safe());

DROP POLICY IF EXISTS "ce_events_insert_tenant" ON public.communication_events;
CREATE POLICY "ce_events_insert_tenant" ON public.communication_events
    FOR INSERT TO anon, authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. communication_preferences — preferências de comunicação por cliente
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communication_preferences (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid DEFAULT public.current_tenant_id_safe(),
    cliente_id          uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
    canal               text DEFAULT 'todos',
    publico             text DEFAULT 'todos',
    ativo               boolean DEFAULT true,
    eventos_permitidos  jsonb DEFAULT '[]'::jsonb,
    branding            jsonb DEFAULT '{}'::jsonb,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    UNIQUE(tenant_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_prefs_cliente_id ON public.communication_preferences(cliente_id);

ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_prefs_select_tenant" ON public.communication_preferences;
CREATE POLICY "cp_prefs_select_tenant" ON public.communication_preferences
    FOR SELECT TO anon, authenticated
    USING (tenant_id = public.current_tenant_id_safe());

DROP POLICY IF EXISTS "cp_prefs_insert_tenant" ON public.communication_preferences;
CREATE POLICY "cp_prefs_insert_tenant" ON public.communication_preferences
    FOR INSERT TO anon, authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. tracking_public_links — links públicos de rastreamento
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tracking_public_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid DEFAULT public.current_tenant_id_safe(),
    os_id           uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    token_publico   text NOT NULL UNIQUE,
    expira_em       timestamptz,
    ativo           boolean DEFAULT true,
    acessos         integer DEFAULT 0,
    ultimo_acesso_em timestamptz,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpl_os_id ON public.tracking_public_links(os_id);
CREATE INDEX IF NOT EXISTS idx_tpl_token ON public.tracking_public_links(token_publico);
CREATE INDEX IF NOT EXISTS idx_tpl_ativo ON public.tracking_public_links(ativo);

ALTER TABLE public.tracking_public_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tpl_links_select_public" ON public.tracking_public_links;
CREATE POLICY "tpl_links_select_public" ON public.tracking_public_links
    FOR SELECT TO anon, authenticated
    USING (ativo = true);

DROP POLICY IF EXISTS "tpl_links_insert_tenant" ON public.tracking_public_links;
CREATE POLICY "tpl_links_insert_tenant" ON public.tracking_public_links
    FOR INSERT TO anon, authenticated
    WITH CHECK (tenant_id = public.current_tenant_id_safe());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SEEDS: Templates padrão
-- ═══════════════════════════════════════════════════════════════════════════════

-- DESTINATÁRIO
INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('dest_entrega_preparacao', 'Entrega em Preparação', 'destinatario', 'entrega_preparacao',
 'Sua entrega está sendo preparada',
 'Olá {{destinatario_nome}},\n\nSua entrega está sendo preparada pela {{transportadora}}.\n\nAcompanhe pelo link: {{link_rastreio}}\n\n{{assinatura}}',
 '[{"var":"destinatario_nome","desc":"Nome do destinatário"},{"var":"transportadora","desc":"Nome da transportadora"},{"var":"link_rastreio","desc":"Link público de rastreio"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('dest_entrega_saiu', 'Saiu para Entrega', 'destinatario', 'entrega_saiu',
 'Sua entrega saiu para entrega',
 'Olá {{destinatario_nome}},\n\nSua entrega saiu para entrega.\nPrevisão de chegada: {{janela_entrega}}.\n\nAcompanhe em tempo real: {{link_rastreio}}\n\n{{assinatura}}',
 '[{"var":"destinatario_nome","desc":"Nome do destinatário"},{"var":"janela_entrega","desc":"Previsão de entrega"},{"var":"link_rastreio","desc":"Link público de rastreio"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('dest_entrega_proxima', 'Entrega Próxima', 'destinatario', 'entrega_proxima',
 'Sua entrega está próxima',
 'Olá {{destinatario_nome}},\n\nSua entrega está próxima do endereço. Prepare alguém para receber.\n\nPrevisão: {{janela_entrega}}\n\nAcompanhe: {{link_rastreio}}\n\n{{assinatura}}',
 '[{"var":"destinatario_nome","desc":"Nome do destinatário"},{"var":"janela_entrega","desc":"Previsão de entrega"},{"var":"link_rastreio","desc":"Link público de rastreio"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('dest_entrega_concluida', 'Entrega Concluída', 'destinatario', 'entrega_concluida',
 'Entrega realizada com sucesso',
 'Olá {{destinatario_nome}},\n\nEntrega realizada com sucesso às {{horario_entrega}}.\n\nProtocolo: {{protocolo_entrega}}\n\n{{assinatura}}',
 '[{"var":"destinatario_nome","desc":"Nome do destinatário"},{"var":"horario_entrega","desc":"Horário da entrega"},{"var":"protocolo_entrega","desc":"Número do protocolo"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('dest_avaliacao', 'Avalie sua Experiência', 'destinatario', 'avaliacao_entrega',
 'Como foi sua experiência?',
 'Olá {{destinatario_nome}},\n\nComo foi sua experiência com a entrega? Avalie aqui: {{link_avaliacao}}\n\nSua opinião é muito importante para nós.\n\n{{assinatura}}',
 '[{"var":"destinatario_nome","desc":"Nome do destinatário"},{"var":"link_avaliacao","desc":"Link de avaliação"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- CLIENTE
INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('cli_os_criada', 'OS Criada', 'cliente', 'os_criada',
 'Ordem de Serviço {{numero_os}} criada',
 'Prezado cliente,\n\nA Ordem de Serviço {{numero_os}} foi criada.\n\nOrigem: {{origem}}\nDestino: {{destino}}\nPrevisão: {{data_prevista}}\n\nAcompanhe pelo painel: {{link_painel}}\n\n{{assinatura}}',
 '[{"var":"numero_os","desc":"Número da OS"},{"var":"origem","desc":"Endereço de origem"},{"var":"destino","desc":"Endereço de destino"},{"var":"data_prevista","desc":"Data prevista"},{"var":"link_painel","desc":"Link do painel do cliente"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('cli_prestador_alocado', 'Prestador Alocado', 'cliente', 'prestador_alocado',
 'Prestador alocado para OS {{numero_os}}',
 'Prezado cliente,\n\nO prestador {{prestador_nome}} foi alocado para a OS {{numero_os}}.\n\nVeículo: {{veiculo_placa}} ({{veiculo_tipo}})\nPrevisão: {{data_prevista}}\n\n{{assinatura}}',
 '[{"var":"numero_os","desc":"Número da OS"},{"var":"prestador_nome","desc":"Nome do prestador"},{"var":"veiculo_placa","desc":"Placa do veículo"},{"var":"veiculo_tipo","desc":"Tipo do veículo"},{"var":"data_prevista","desc":"Data prevista"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('cli_em_operacao', 'Em Operação', 'cliente', 'em_operacao',
 'OS {{numero_os}} em operação',
 'Prezado cliente,\n\nA OS {{numero_os}} está em operação.\n\nPrestador: {{prestador_nome}}\nStatus: {{status_atual}}\nPrevisão de entrega: {{previsao_entrega}}\n\nAcompanhe em tempo real: {{link_rastreio}}\n\n{{assinatura}}',
 '[{"var":"numero_os","desc":"Número da OS"},{"var":"prestador_nome","desc":"Nome do prestador"},{"var":"status_atual","desc":"Status atual da operação"},{"var":"previsao_entrega","desc":"Previsão de entrega"},{"var":"link_rastreio","desc":"Link de rastreio"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('cli_ocorrencia', 'Ocorrência Registrada', 'cliente', 'ocorrencia_registrada',
 'Ocorrência na OS {{numero_os}}',
 'Prezado cliente,\n\nUma ocorrência foi registrada na OS {{numero_os}}.\n\nTipo: {{tipo_ocorrencia}}\nDescrição: {{descricao_ocorrencia}}\n\nNossa equipe já está atuando. Entraremos em contato em breve.\n\n{{assinatura}}',
 '[{"var":"numero_os","desc":"Número da OS"},{"var":"tipo_ocorrencia","desc":"Tipo da ocorrência"},{"var":"descricao_ocorrencia","desc":"Descrição da ocorrência"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('cli_entrega_concluida', 'Entrega Concluída', 'cliente', 'entrega_concluida',
 'OS {{numero_os}} concluída',
 'Prezado cliente,\n\nA OS {{numero_os}} foi concluída com sucesso.\n\nEntregue em: {{data_entrega}}\nRecebedor: {{recebedor_nome}}\n\nO comprovante de entrega está disponível no painel.\n\n{{assinatura}}',
 '[{"var":"numero_os","desc":"Número da OS"},{"var":"data_entrega","desc":"Data da entrega"},{"var":"recebedor_nome","desc":"Nome do recebedor"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- PRESTADOR
INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('pres_nova_operacao', 'Nova Operação', 'prestador', 'nova_operacao',
 'Nova operação disponível',
 'Olá {{prestador_nome}},\n\nUma nova operação está disponível.\n\nOrigem: {{origem}}\nDestino: {{destino}}\nData: {{data_operacao}}\nValor: {{valor_operacao}}\n\nAcesse o app para aceitar.\n\n{{assinatura}}',
 '[{"var":"prestador_nome","desc":"Nome do prestador"},{"var":"origem","desc":"Endereço de origem"},{"var":"destino","desc":"Endereço de destino"},{"var":"data_operacao","desc":"Data da operação"},{"var":"valor_operacao","desc":"Valor da operação"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('pres_janela_risco', 'Janela em Risco', 'prestador', 'janela_em_risco',
 'Atenção: janela de entrega em risco',
 'Olá {{prestador_nome}},\n\nA janela de entrega da OS {{numero_os}} está em risco.\n\nPrevisão: {{janela_entrega}}\nTempo restante: {{tempo_restante}}\n\nAcelere o processo se possível ou reporte uma ocorrência.\n\n{{assinatura}}',
 '[{"var":"prestador_nome","desc":"Nome do prestador"},{"var":"numero_os","desc":"Número da OS"},{"var":"janela_entrega","desc":"Janela de entrega"},{"var":"tempo_restante","desc":"Tempo restante"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

INSERT INTO public.communication_templates (codigo, nome, publico, evento, assunto, corpo, variaveis, branding) VALUES
('pres_ocorrencia', 'Ocorrência Recebida', 'prestador', 'ocorrencia_recebida',
 'Ocorrência registrada na OS {{numero_os}}',
 'Olá {{prestador_nome}},\n\nUma ocorrência foi registrada na OS {{numero_os}}.\n\nTipo: {{tipo_ocorrencia}}\nInstrução: {{instrucao}}\n\nEntre em contato com a torre de controle se necessário.\n\n{{assinatura}}',
 '[{"var":"prestador_nome","desc":"Nome do prestador"},{"var":"numero_os","desc":"Número da OS"},{"var":"tipo_ocorrencia","desc":"Tipo da ocorrência"},{"var":"instrucao","desc":"Instrução para o prestador"},{"var":"assinatura","desc":"Assinatura da transportadora"}]'::jsonb,
 '{"logo_url":"","cor_primaria":"#1a365d"}'::jsonb)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CONFIGURAÇÃO PADRÃO DE BRANDING
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.communication_preferences (cliente_id, canal, publico, ativo, eventos_permitidos, branding) VALUES
(NULL, 'todos', 'todos', true,
 '["os_criada","prestador_alocado","prestador_aceitou","em_operacao","entrega_preparacao","entrega_saiu","entrega_proxima","entrega_concluida","avaliacao_entrega","ocorrencia_registrada","pod_disponivel","nova_operacao","janela_em_risco","ocorrencia_recebida"]'::jsonb,
 '{"logo_url":"","nome_exibicao":"Conexão Express","cor_primaria":"#1a365d","cor_secundaria":"#2b6cb0","assinatura_texto":"Entrega acompanhada por Conexão Express — tecnologia logística inteligente.","texto_rodape":"© Conexão Express Transportes"}'::jsonb)
ON CONFLICT (tenant_id, cliente_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. COMENTÁRIOS
-- ═══════════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE public.communication_templates IS 'Templates de comunicação — Missão 46. Define mensagens por evento/público/canal.';
COMMENT ON TABLE public.communication_events IS 'Eventos de comunicação gerados — Missão 46. Histórico de todas as comunicações enviadas/simuladas.';
COMMENT ON TABLE public.communication_preferences IS 'Preferências de comunicação por cliente — Missão 46. Branding white-label e canais permitidos.';
COMMENT ON TABLE public.tracking_public_links IS 'Links públicos de rastreamento — Missão 46. Tokens seguros para destinatários.';
