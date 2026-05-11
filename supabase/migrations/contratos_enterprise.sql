-- =====================================================
-- CONTRATOS ENTERPRISE - Supabase Migration
-- Sistema de Geração, Assinatura Digital e Aceite WhatsApp
-- =====================================================

-- 1. TABELA PRINCIPAL DE CONTRATOS
CREATE TABLE IF NOT EXISTS public.contratos_gerados (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_contrato text UNIQUE NOT NULL,
    prestador_id uuid,
    prestador_nome text,
    prestador_cpf text,
    prestador_cnpj text,
    prestador_rntrc text,
    prestador_telefone text,
    modelo_id uuid,
    tipo_contrato text NOT NULL DEFAULT 'TAC',
    status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'aceito_whatsapp', 'assinado', 'recusado', 'cancelado')),
    
    conteudo_html text,
    conteudo_textex text,
    pdf_url text,
    hash_documento text,
    
    -- Aceite WhatsApp
    aceite_whatsapp boolean DEFAULT false,
    aceite_whatsapp_data timestamptz,
    aceite_whatsapp_numero text,
    aceite_whatsapp_mensagem text,
    
    -- Assinatura Eletrônica
    assinatura_eletronica boolean DEFAULT false,
    assinatura_data timestamptz,
    assinatura_ip text,
    assinatura_navegador text,
    assinatura_geolocalizacao text,
    assinatura_imagem text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Índices para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_contratos_prestador ON public.contratos_gerados(prestador_id);
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON public.contratos_gerados(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos_gerados(status);
CREATE INDEX IF NOT EXISTS idx_contratos_tipo ON public.contratos_gerados(tipo_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_created ON public.contratos_gerados(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_hash ON public.contratos_gerados(hash_documento);

-- RLS
ALTER TABLE public.contratos_gerados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_select" ON public.contratos_gerados;
CREATE POLICY "contratos_select" ON public.contratos_gerados FOR SELECT USING (true);

DROP POLICY IF EXISTS "contratos_insert" ON public.contratos_gerados;
CREATE POLICY "contratos_insert" ON public.contratos_gerados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "contratos_update" ON public.contratos_gerados;
CREATE POLICY "contratos_update" ON public.contratos_gerados FOR UPDATE USING (true);

-- 2. TABELA DE MODELOS DE CONTRATO
CREATE TABLE IF NOT EXISTS public.contratos_modelos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL DEFAULT 'TAC',
    conteudo_base text NOT NULL,
    variaveis text[] DEFAULT '{}',
    ativa boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_modelos_tipo ON public.contratos_modelos(tipo);
CREATE INDEX IF NOT EXISTS idx_contratos_modelos_ativa ON public.contratos_modelos(ativa);

ALTER TABLE public.contratos_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modelos_select" ON public.contratos_modelos;
CREATE POLICY "modelos_select" ON public.contratos_modelos FOR SELECT USING (true);

DROP POLICY IF EXISTS "modelos_insert" ON public.contratos_modelos;
CREATE POLICY "modelos_insert" ON public.contratos_modelos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "modelos_update" ON public.contratos_modelos;
CREATE POLICY "modelos_update" ON public.contratos_modelos FOR UPDATE USING (true);

-- 3. TABELA DE HISTÓRICO DE CONTRATOS
CREATE TABLE IF NOT EXISTS public.contratos_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id uuid NOT NULL,
    acao text NOT NULL,
    descricao text,
    detalhes jsonb DEFAULT '{}',
    usuario text,
    ip text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_historico_contrato ON public.contratos_historico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_historico_created ON public.contratos_historico(created_at DESC);

ALTER TABLE public.contratos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_select" ON public.contratos_historico;
CREATE POLICY "historico_select" ON public.contratos_historico FOR SELECT USING (true);

DROP POLICY IF EXISTS "historico_insert" ON public.contratos_historico;
CREATE POLICY "historico_insert" ON public.contratos_historico FOR INSERT WITH CHECK (true);

-- 4. STORAGE - Bucket para PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contratos', 'contratos', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Política de acesso público para leitura
DROP POLICY IF EXISTS "contratos_bucket_public_read" ON storage.objects;
CREATE POLICY "contratos_bucket_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'contratos');

-- Política de upload para authenticated
DROP POLICY IF EXISTS "contratos_bucket_upload" ON storage.objects;
CREATE POLICY "contratos_bucket_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contratos' AND auth.role() IN ('authenticated', 'service_role'));

-- Política de update para authenticated
DROP POLICY IF EXISTS "contratos_bucket_update" ON storage.objects;
CREATE POLICY "contratos_bucket_update" ON storage.objects FOR UPDATE USING (bucket_id = 'contratos' AND auth.role() IN ('authenticated', 'service_role'));

-- 5. TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contratos_updated_at ON public.contratos_gerados;
CREATE TRIGGER update_contratos_updated_at
    BEFORE UPDATE ON public.contratos_gerados
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_modelos_updated_at ON public.contratos_modelos;
CREATE TRIGGER update_modelos_updated_at
    BEFORE UPDATE ON public.contratos_modelos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. FUNÇÃO PARA GERAR NÚMERO DE CONTRATO
CREATE OR REPLACE FUNCTION public.gerar_numero_contrato()
RETURNS text AS $$
DECLARE
    ano text;
    proximo_numero integer;
    numero_formatado text;
BEGIN
    ano := EXTRACT(YEAR FROM now())::text;
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN numero_contrato ~ ('^CTR-' || ano || '-[0-9]{6}$')
            THEN NULLIF(SUBSTRING(numero_contrato FROM 12 FOR 6), '')::integer
            ELSE NULL
        END
    ), 0) + 1
    INTO proximo_numero
    FROM public.contratos_gerados
    WHERE numero_contrato LIKE 'CTR-' || ano || '-%';
    
    numero_formatado := 'CTR-' || ano || '-' || LPAD(proximo_numero::text, 6, '0');
    RETURN numero_formatado;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. FUNÇÃO PARA REGISTRAR HISTÓRICO
CREATE OR REPLACE FUNCTION public.registrar_contrato_historico(
    p_contrato_id uuid,
    p_acao text,
    p_descricao text,
    p_detalhes jsonb DEFAULT '{}'::jsonb,
    p_usuario text DEFAULT NULL,
    p_ip text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.contratos_historico (contrato_id, acao, descricao, detalhes, usuario, ip)
    VALUES (p_contrato_id, p_acao, p_descricao, p_detalhes, p_usuario, p_ip);
END;
$$ LANGUAGE plpgsql;

-- 8. SEED - Modelo base de contrato TAC
INSERT INTO public.contratos_modelos (id, nome, tipo, conteudo_base, variaveis, ativa)
VALUES (
    gen_random_uuid(),
    'TAC - Transporte Autônomo de Carga',
    'TAC',
    '{{cabeçalho}}
    
{{cláusulas_tAC}}

{{cláusulas_recorrência}}

{{cláusulas_thermográficas}}

{{rodapé}}
',
    ARRAY['prestador_nome', 'prestador_cpf', 'prestador_cnpj', 'prestador_rntrc', 'prestador_placa', 'prestador_modelo', 'prestador_tipo_veiculo', 'prestador_tipo_carga', 'prestador_valor_saida', 'empresa_nome', 'empresa_cnpj', 'empresa_endereco', 'data_atual'],
    true
)
ON CONFLICT DO NOTHING;

INSERT INTO public.contratos_modelos (id, nome, tipo, conteudo_base, variaveis, ativa)
VALUES (
    gen_random_uuid(),
    'ETC - Transporte Emergencial de Carga',
    'ETC',
    '{{cabeçalho}}

{{cláusulas_ETC}}

{{rodapé}}',
    ARRAY['prestador_nome', 'prestador_cpf', 'prestador_cnpj', 'empresa_nome', 'empresa_cnpj', 'data_atual'],
    true
)
ON CONFLICT DO NOTHING;

-- 9. SEED - Dados de teste
INSERT INTO public.contratos_gerados (
    numero_contrato,
    prestador_nome,
    prestador_cpf,
    tipo_contrato,
    status,
    created_at
)
SELECT 
    gerar_numero_contrato(),
    'João Silva Santos',
    '123.456.789-00',
    'TAC',
    'pendente',
    now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.contratos_gerados WHERE prestador_cpf = '123.456.789-00' LIMIT 1);

-- 10. Realtime para contratos
ALTER TABLE public.contratos_gerados REPLICA IDENTITY FULL;
ALTER TABLE public.contratos_historico REPLICA IDENTITY FULL;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contratos_gerados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contratos_historico;