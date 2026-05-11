-- =====================================================
-- PORTAL CLIENTE ENTERPRISE - Supabase Migration
-- Created: Portal Cliente Enterprise Tables
-- =====================================================

-- 1. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.portal_notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    tipo text NOT NULL DEFAULT 'sistema',
    titulo text NOT NULL,
    mensagem text NOT NULL,
    canal text DEFAULT 'portal',
    lida boolean DEFAULT false,
    prioridade text DEFAULT 'normal',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_cliente ON public.portal_notificacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_os ON public.portal_notificacoes(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_lida ON public.portal_notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_created ON public.portal_notificacoes(created_at DESC);

ALTER TABLE public.portal_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_notificacoes_select" ON public.portal_notificacoes;
CREATE POLICY "portal_notificacoes_select" ON public.portal_notificacoes FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public.portal_notificacoes;
CREATE POLICY "portal_notificacoes_insert" ON public.portal_notificacoes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_notificacoes_update" ON public.portal_notificacoes;
CREATE POLICY "portal_notificacoes_update" ON public.portal_notificacoes FOR UPDATE USING (true);

ALTER TABLE public.portal_notificacoes REPLICA IDENTITY FULL;

-- 2. OCORRÊNCIAS
CREATE TABLE IF NOT EXISTS public.portal_ocorrencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    veiculo_id uuid,
    tipo text NOT NULL,
    descricao text NOT NULL,
    prioridade text DEFAULT 'normal',
    status text DEFAULT 'aberta',
    anexos jsonb DEFAULT '[]',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_cliente ON public.portal_ocorrencias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_os ON public.portal_ocorrencias(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_status ON public.portal_ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_created ON public.portal_ocorrencias(created_at DESC);

ALTER TABLE public.portal_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
CREATE POLICY "portal_ocorrencias_select" ON public.portal_ocorrencias FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public.portal_ocorrencias;
CREATE POLICY "portal_ocorrencias_insert" ON public.portal_ocorrencias FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;
CREATE POLICY "portal_ocorrencias_update" ON public.portal_ocorrencias FOR UPDATE USING (true);

ALTER TABLE public.portal_ocorrencias REPLICA IDENTITY FULL;

-- 3. AVALIAÇÕES
CREATE TABLE IF NOT EXISTS public.portal_avaliacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    nota integer NOT NULL CHECK (nota >= 1 AND nota <= 5),
    nps integer,
    comentario text,
    canal text DEFAULT 'portal',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_cliente ON public.portal_avaliacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_os ON public.portal_avaliacoes(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_nota ON public.portal_avaliacoes(nota);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_created ON public.portal_avaliacoes(created_at DESC);

ALTER TABLE public.portal_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
CREATE POLICY "portal_avaliacoes_select" ON public.portal_avaliacoes FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public.portal_avaliacoes;
CREATE POLICY "portal_avaliacoes_insert" ON public.portal_avaliacoes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;
CREATE POLICY "portal_avaliacoes_update" ON public.portal_avaliacoes FOR UPDATE USING (true);

ALTER TABLE public.portal_avaliacoes REPLICA IDENTITY FULL;

-- 4. COMPROVANTES
CREATE TABLE IF NOT EXISTS public.portal_comprovantes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    veiculo_id uuid,
    tipo text NOT NULL DEFAULT 'entrega',
    titulo text NOT NULL,
    url text,
    nome_recebedor text,
    documento_recebedor text,
    data_entrega timestamptz,
    latitude numeric,
    longitude numeric,
    fotos jsonb DEFAULT '[]',
    assinatura_url text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_cliente ON public.portal_comprovantes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_os ON public.portal_comprovantes(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_tipo ON public.portal_comprovantes(tipo);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_created ON public.portal_comprovantes(created_at DESC);

ALTER TABLE public.portal_comprovantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
CREATE POLICY "portal_comprovantes_select" ON public.portal_comprovantes FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public.portal_comprovantes;
CREATE POLICY "portal_comprovantes_insert" ON public.portal_comprovantes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;
CREATE POLICY "portal_comprovantes_update" ON public.portal_comprovantes FOR UPDATE USING (true);

ALTER TABLE public.portal_comprovantes REPLICA IDENTITY FULL;

-- 5. PROTOCOLOS
CREATE TABLE IF NOT EXISTS public.portal_protocolos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    comprovante_id uuid,
    protocolo text NOT NULL,
    status text DEFAULT 'pendente',
    recebedor text,
    horario timestamptz,
    localizacao jsonb DEFAULT '{}',
    eventos jsonb DEFAULT '[]',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_protocolos_cliente ON public.portal_protocolos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_os ON public.portal_protocolos(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_status ON public.portal_protocolos(status);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_protocolo ON public.portal_protocolos(protocolo);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_created ON public.portal_protocolos(created_at DESC);

ALTER TABLE public.portal_protocolos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
CREATE POLICY "portal_protocolos_select" ON public.portal_protocolos FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_protocolos_insert" ON public.portal_protocolos;
CREATE POLICY "portal_protocolos_insert" ON public.portal_protocolos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;
CREATE POLICY "portal_protocolos_update" ON public.portal_protocolos FOR UPDATE USING (true);

ALTER TABLE public.portal_protocolos REPLICA IDENTITY FULL;

-- 6. ROTAS
CREATE TABLE IF NOT EXISTS public.portal_rotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    nome text NOT NULL,
    status text DEFAULT 'rascunho',
    destinos jsonb DEFAULT '[]',
    veiculos_sugeridos jsonb DEFAULT '[]',
    km_estimado numeric DEFAULT 0,
    tempo_estimado_min integer DEFAULT 0,
    custo_estimado numeric DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_rotas_cliente ON public.portal_rotas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_rotas_status ON public.portal_rotas(status);
CREATE INDEX IF NOT EXISTS idx_portal_rotas_created ON public.portal_rotas(created_at DESC);

ALTER TABLE public.portal_rotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
CREATE POLICY "portal_rotas_select" ON public.portal_rotas FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_rotas_insert" ON public.portal_rotas;
CREATE POLICY "portal_rotas_insert" ON public.portal_rotas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;
CREATE POLICY "portal_rotas_update" ON public.portal_rotas FOR UPDATE USING (true);

ALTER TABLE public.portal_rotas REPLICA IDENTITY FULL;

-- 7. TRACKING REAL-TIME
CREATE TABLE IF NOT EXISTS public.portal_tracking_realtime (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    os_id uuid,
    prestador_id uuid,
    veiculo_id uuid,
    status text DEFAULT 'offline',
    latitude numeric,
    longitude numeric,
    eta_min integer,
    velocidade numeric,
    bateria numeric,
    metadata jsonb DEFAULT '{}',
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_tracking_cliente ON public.portal_tracking_realtime(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_os ON public.portal_tracking_realtime(os_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_prestador ON public.portal_tracking_realtime(prestador_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_updated ON public.portal_tracking_realtime(updated_at DESC);

ALTER TABLE public.portal_tracking_realtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_tracking_select" ON public.portal_tracking_realtime;
CREATE POLICY "portal_tracking_select" ON public.portal_tracking_realtime FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_tracking_insert" ON public.portal_tracking_realtime;
CREATE POLICY "portal_tracking_insert" ON public.portal_tracking_realtime FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_tracking_update" ON public.portal_tracking_realtime;
CREATE POLICY "portal_tracking_update" ON public.portal_tracking_realtime FOR UPDATE USING (true);

ALTER TABLE public.portal_tracking_realtime REPLICA IDENTITY FULL;

-- 8. RELATÓRIOS
CREATE TABLE IF NOT EXISTS public.portal_relatorios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    tipo text NOT NULL,
    titulo text NOT NULL,
    periodo_inicio date,
    periodo_fim date,
    url text,
    formato text DEFAULT 'csv',
    filtros jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_relatorios_cliente ON public.portal_relatorios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_relatorios_tipo ON public.portal_relatorios(tipo);
CREATE INDEX IF NOT EXISTS idx_portal_relatorios_created ON public.portal_relatorios(created_at DESC);

ALTER TABLE public.portal_relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
CREATE POLICY "portal_relatorios_select" ON public.portal_relatorios FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_relatorios_insert" ON public.portal_relatorios;
CREATE POLICY "portal_relatorios_insert" ON public.portal_relatorios FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;
CREATE POLICY "portal_relatorios_update" ON public.portal_relatorios FOR UPDATE USING (true);

ALTER TABLE public.portal_relatorios REPLICA IDENTITY FULL;

-- 9. FATURAS
CREATE TABLE IF NOT EXISTS public.portal_faturas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    numero text NOT NULL,
    competencia text NOT NULL,
    valor numeric DEFAULT 0,
    vencimento date,
    status text DEFAULT 'aberta',
    url_boleto text,
    url_nf text,
    os_ids jsonb DEFAULT '[]',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_faturas_cliente ON public.portal_faturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_numero ON public.portal_faturas(numero);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_status ON public.portal_faturas(status);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_vencimento ON public.portal_faturas(vencimento);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_created ON public.portal_faturas(created_at DESC);

ALTER TABLE public.portal_faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
CREATE POLICY "portal_faturas_select" ON public.portal_faturas FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_faturas_insert" ON public.portal_faturas;
CREATE POLICY "portal_faturas_insert" ON public.portal_faturas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;
CREATE POLICY "portal_faturas_update" ON public.portal_faturas FOR UPDATE USING (true);

ALTER TABLE public.portal_faturas REPLICA IDENTITY FULL;

-- 10. PREFERÊNCIAS DO CLIENTE
CREATE TABLE IF NOT EXISTS public.portal_preferencias_cliente (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid UNIQUE,
    logo_url text,
    cor_primaria text DEFAULT '#F97316',
    nome_exibicao text,
    notificacoes jsonb DEFAULT '{"email": true, "push": true, "sms": false}',
    permissoes jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_preferencias_cliente ON public.portal_preferencias_cliente(cliente_id);

ALTER TABLE public.portal_preferencias_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
CREATE POLICY "portal_preferencias_select" ON public.portal_preferencias_cliente FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_preferencias_insert" ON public.portal_preferencias_cliente;
CREATE POLICY "portal_preferencias_insert" ON public.portal_preferencias_cliente FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;
CREATE POLICY "portal_preferencias_update" ON public.portal_preferencias_cliente FOR UPDATE USING (true);

ALTER TABLE public.portal_preferencias_cliente REPLICA IDENTITY FULL;

-- =====================================================
-- SEED DE TESTE - Dados mínimos para testes
-- =====================================================

-- Notificações de teste
INSERT INTO public.portal_notificacoes (id, tipo, titulo, mensagem, canal, lida, prioridade, created_at)
SELECT gen_random_uuid(), 'entrega', 'Entrega realizada', 'OS-202610-1028 foi entregue com sucesso', 'portal', false, 'normal', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_notificacoes WHERE titulo = 'Entrega realizada' LIMIT 1);

INSERT INTO public.portal_notificacoes (id, tipo, titulo, mensagem, canal, lida, prioridade, created_at)
SELECT gen_random_uuid(), 'risco', 'Risco de atraso', 'OS-202610-1015 pode atrasar', 'portal', false, 'alta', now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_notificacoes WHERE titulo = 'Risco de atraso' LIMIT 1);

INSERT INTO public.portal_notificacoes (id, tipo, titulo, mensagem, canal, lida, prioridade, created_at)
SELECT gen_random_uuid(), 'sistema', 'Pedido recebido', 'Seu novo pedido foi cadastrado com sucesso', 'portal', false, 'baixa', now() - interval '3 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_notificacoes WHERE titulo = 'Pedido recebido' LIMIT 1);

-- Comprovantes de teste
INSERT INTO public.portal_comprovantes (id, tipo, titulo, nome_recebedor, documento_recebedor, data_entrega, created_at)
SELECT gen_random_uuid(), 'entrega', 'OS-202610-1028 - Comprovante', 'Carlos Manager', '12.345.678/0001-90', now() - interval '1 day', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_comprovantes WHERE titulo LIKE 'OS-202610-1028%' LIMIT 1);

INSERT INTO public.portal_comprovantes (id, tipo, titulo, nome_recebedor, documento_recebedor, data_entrega, created_at)
SELECT gen_random_uuid(), 'entrega', 'OS-202609-9802 - Comprovante', 'Pedro Souza', '11.222.333/0001-44', now() - interval '5 days', now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_comprovantes WHERE titulo LIKE 'OS-202609-9802%' LIMIT 1);

-- Ocorrências de teste
INSERT INTO public.portal_ocorrencias (id, tipo, descricao, prioridade, status, created_at)
SELECT gen_random_uuid(), 'atraso', 'Atraso por tráfego intenso na marginal', 'media', 'resolvida', now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_ocorrencias WHERE tipo = 'atraso' LIMIT 1);

INSERT INTO public.portal_ocorrencias (id, tipo, descricao, prioridade, status, created_at)
SELECT gen_random_uuid(), 'avariado', 'Produto avariado no transporte', 'alta', 'aberta', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_ocorrencias WHERE tipo = 'avariado' LIMIT 1);

-- Avaliações de teste
INSERT INTO public.portal_avaliacoes (id, nota, comentario, canal, created_at)
SELECT gen_random_uuid(), 5, 'Entrega super rápida!', 'portal', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_avaliacoes WHERE comentario = 'Entrega super rápida!' LIMIT 1);

INSERT INTO public.portal_avaliacoes (id, nota, comentario, canal, created_at)
SELECT gen_random_uuid(), 4, 'Tudo certo, recomendo', 'portal', now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_avaliacoes WHERE comentario = 'Tudo certo, recomendo' LIMIT 1);

-- Rotas de teste
INSERT INTO public.portal_rotas (id, nome, status, km_estimado, tempo_estimado_min, custo_estimado, created_at)
SELECT gen_random_uuid(), 'Rota Zona Sul', 'ativa', 45, 120, 350.00, now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_rotas WHERE nome = 'Rota Zona Sul' LIMIT 1);

INSERT INTO public.portal_rotas (id, nome, status, km_estimado, tempo_estimado_min, custo_estimado, created_at)
SELECT gen_random_uuid(), 'Rota Zona Norte', 'rascunho', 62, 180, 520.00, now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_rotas WHERE nome = 'Rota Zona Norte' LIMIT 1);

-- Faturas de teste
INSERT INTO public.portal_faturas (id, numero, competencia, valor, vencimento, status, created_at)
SELECT gen_random_uuid(), 'FAT-0045', '04/2026', 14500.00, '2026-05-10', 'a_vencer', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_faturas WHERE numero = 'FAT-0045' LIMIT 1);

INSERT INTO public.portal_faturas (id, numero, competencia, valor, vencimento, status, created_at)
SELECT gen_random_uuid(), 'FAT-0044', '03/2026', 2800.00, '2026-04-10', 'paga', now() - interval '30 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_faturas WHERE numero = 'FAT-0044' LIMIT 1);

-- Protocolos de teste
INSERT INTO public.portal_protocolos (id, protocolo, status, recebedor, horario, created_at)
SELECT gen_random_uuid(), 'PRT-2026100001', 'entregue', 'Carlos Manager', now() - interval '1 day', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_protocolos WHERE protocolo = 'PRT-2026100001' LIMIT 1);

INSERT INTO public.portal_protocolos (id, protocolo, status, recebedor, horario, created_at)
SELECT gen_random_uuid(), 'PRT-2026099802', 'entregue', 'Pedro Souza', now() - interval '5 days', now() - interval '5 days'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_protocolos WHERE protocolo = 'PRT-2026099802' LIMIT 1);

-- =====================================================
-- REALTIME PREPARATION
-- =====================================================
-- Habilitar realtime nas tabelas mais críticas
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_ocorrencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_comprovantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_tracking_realtime;

-- =====================================================
-- Função helper para atualizar updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para portal_rotas
DROP TRIGGER IF EXISTS update_portal_rotas_updated_at ON public.portal_rotas;
CREATE TRIGGER update_portal_rotas_updated_at
    BEFORE UPDATE ON public.portal_rotas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para portal_ocorrencias
DROP TRIGGER IF EXISTS update_portal_ocorrencias_updated_at ON public.portal_ocorrencias;
CREATE TRIGGER update_portal_ocorrencias_updated_at
    BEFORE UPDATE ON public.portal_ocorrencias
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para portal_preferencias_cliente
DROP TRIGGER IF EXISTS update_portal_preferencias_updated_at ON public.portal_preferencias_cliente;
CREATE TRIGGER update_portal_preferencias_updated_at
    BEFORE UPDATE ON public.portal_preferencias_cliente
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();