-- Migration: dreamflow tables for motorista app
-- Created automatically by Antigravity

-- Table: motorista_app_sessoes
CREATE TABLE IF NOT EXISTS public.motorista_app_sessoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    motorista_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
    token text UNIQUE NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- Table: motorista_checkins
CREATE TABLE IF NOT EXISTS public.motorista_checkins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    prestador_id uuid REFERENCES public.prestadores(id) ON DELETE CASCADE,
    escala_id uuid REFERENCES public.escala_operacional(id) ON DELETE SET NULL,
    tipo text NOT NULL, -- e.g., 'inicio_viagem', 'chegada_cliente', 'fim_viagem'
    latitude numeric,
    longitude numeric,
    observacao text,
    created_at timestamptz DEFAULT now()
);

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE motorista_app_sessoes;
ALTER PUBLICATION supabase_realtime ADD TABLE motorista_checkins;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_motorista_sessoes_token ON public.motorista_app_sessoes(token);
CREATE INDEX IF NOT EXISTS idx_motorista_checkins_escala ON public.motorista_checkins(escala_id);
CREATE INDEX IF NOT EXISTS idx_motorista_checkins_prestador ON public.motorista_checkins(prestador_id);
