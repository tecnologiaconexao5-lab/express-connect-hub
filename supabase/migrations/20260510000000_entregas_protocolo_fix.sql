-- Tabela entregas_protocolo (fonte oficial de POD)
-- Referenciada por: m108c1, m99_event_bus, m104_go_live, m113_portal_security, m114_portal_conclusao

CREATE TABLE IF NOT EXISTS public.entregas_protocolo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alocacao_id uuid,
    prestador_id uuid,
    ordem_servico_id uuid,
    nome_recebedor text,
    documento_recebedor text,
    observacao text,
    foto_entrega_url text,
    foto_canhoto_url text,
    assinatura_url text,
    data_hora_entrega timestamptz,
    latitude numeric,
    longitude numeric,
    status text DEFAULT 'entregue',
    gps_accuracy numeric,
    receiver_relationship text,
    parada_id uuid,
    tenant_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_alocacao_id ON public.entregas_protocolo(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_os_id ON public.entregas_protocolo(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_prestador_id ON public.entregas_protocolo(prestador_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_tenant_id ON public.entregas_protocolo(tenant_id);

ALTER TABLE public.entregas_protocolo ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'entregas_protocolo_select_authenticated' AND tablename = 'entregas_protocolo'
    ) THEN
        CREATE POLICY entregas_protocolo_select_authenticated ON public.entregas_protocolo FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'entregas_protocolo_insert_authenticated' AND tablename = 'entregas_protocolo'
    ) THEN
        CREATE POLICY entregas_protocolo_insert_authenticated ON public.entregas_protocolo FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'entregas_protocolo_update_authenticated' AND tablename = 'entregas_protocolo'
    ) THEN
        CREATE POLICY entregas_protocolo_update_authenticated ON public.entregas_protocolo FOR UPDATE USING (true);
    END IF;
END $$;

ALTER TABLE public.entregas_protocolo REPLICA IDENTITY FULL;
