-- =====================================================
-- PORTAL PEDIDOS - Supabase Migration
-- Sistema de Pedidos do Portal Cliente
-- =====================================================

-- 1. TABELA PRINCIPAL
CREATE TABLE IF NOT EXISTS public.portal_pedidos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid,
    numero_pedido text UNIQUE,
    status text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'em_analise', 'programado', 'coleta', 'em_rota', 'entregue', 'cancelado')),
    
    -- Solicitante
    solicitante_nome text,
    solicitante_email text,
    solicitante_telefone text,
    
    -- Unidade
    filial text,
    centro_custo text,
    
    -- Prioridade
    prioridade text DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    
    -- Coleta
    coleta_cep text,
    coleta_rua text,
    coleta_numero text,
    coleta_complemento text,
    coleta_bairro text,
    coleta_cidade text,
    coleta_uf text,
    coleta_referencia text,
    coleta_data timestamptz,
    
    -- Entrega
    entrega_destinatario text,
    entrega_telefone text,
    entrega_email text,
    entrega_notificar_whatsapp boolean DEFAULT false,
    entrega_notificar_email boolean DEFAULT false,
    entrega_cep text,
    entrega_rua text,
    entrega_numero text,
    entrega_complemento text,
    entrega_bairro text,
    entrega_cidade text,
    entrega_uf text,
    entrega_referencia text,
    entrega_data timestamptz,
    
    -- Mercadoria
    descricao text,
    volumes integer DEFAULT 1,
    peso numeric DEFAULT 0,
    comprimento numeric DEFAULT 0,
    largura numeric DEFAULT 0,
    altura numeric DEFAULT 0,
    valor_declarado numeric DEFAULT 0,
    tipo_carga text,
    observacoes text,
    
    -- Inteligência
    veiculo_sugerido text,
    prazo_estimado text,
    
    -- Automação
    payload_n8n jsonb DEFAULT '{}',
    os_vinculada_id uuid,
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_cliente ON public.portal_pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_numero ON public.portal_pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_status ON public.portal_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_prioridade ON public.portal_pedidos(prioridade);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_cidade ON public.portal_pedidos(entrega_cidade);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_created ON public.portal_pedidos(created_at DESC);

-- 3. RLS
ALTER TABLE public.portal_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
CREATE POLICY "portal_pedidos_select" ON public.portal_pedidos FOR SELECT USING (true);

DROP POLICY IF EXISTS "portal_pedidos_insert" ON public.portal_pedidos;
CREATE POLICY "portal_pedidos_insert" ON public.portal_pedidos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "portal_pedidos_update" ON public.portal_pedidos;
CREATE POLICY "portal_pedidos_update" ON public.portal_pedidos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "portal_pedidos_delete" ON public.portal_pedidos;
CREATE POLICY "portal_pedidos_delete" ON public.portal_pedidos FOR DELETE USING (true);

-- 4. TRIGGER updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portal_pedidos_updated_at ON public.portal_pedidos;
CREATE TRIGGER update_portal_pedidos_updated_at
    BEFORE UPDATE ON public.portal_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. FUNÇÃO PARA GERAR NÚMERO
CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
RETURNS text AS $$
DECLARE
    ano text;
    proximo_numero integer;
    numero_formatado text;
BEGIN
    ano := EXTRACT(YEAR FROM now())::text;
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN numero_pedido ~ ('^PED-' || ano || '-[0-9]{6}$')
            THEN NULLIF(SUBSTRING(numero_pedido FROM 8 FOR 6), '')::integer
            ELSE NULL
        END
    ), 0) + 1
    INTO proximo_numero
    FROM public.portal_pedidos
    WHERE numero_pedido LIKE 'PED-' || ano || '-%';
    
    numero_formatado := 'PED-' || ano || '-' || LPAD(proximo_numero::text, 6, '0');
    RETURN numero_formatado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. SEED TESTE
INSERT INTO public.portal_pedidos (
    numero_pedido,
    status,
    solicitante_nome,
    solicitante_email,
    prioridade,
    coleta_cidade,
    entrega_destinatario,
    entrega_cidade,
    entrega_uf,
    descricao,
    volumes,
    peso,
    veiculo_sugerido,
    created_at
)
SELECT 
    gerar_numero_pedido(),
    'enviado',
    'Cliente Teste',
    'teste@email.com',
    'normal',
    'São Paulo',
    'João Silva',
    'Rio de Janeiro',
    'RJ',
    'Mercadoria Teste',
    2,
    15.5,
    'Van',
    now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.portal_pedidos WHERE solicitante_email = 'teste@email.com' LIMIT 1);

-- 7. REALTIME
ALTER TABLE public.portal_pedidos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_pedidos;