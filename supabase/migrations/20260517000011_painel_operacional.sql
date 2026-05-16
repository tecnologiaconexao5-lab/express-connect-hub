-- Migration: operacao_localizacao table for realtime operational panel
-- Created automatically by Antigravity

CREATE TABLE IF NOT EXISTS public.operacao_localizacao (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    escala_id uuid REFERENCES escala_operacional(id) ON DELETE CASCADE,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    velocidade numeric,
    status text,
    atualizado_em timestamptz DEFAULT now(),
    origem text
);

-- Enable realtime on the table (Supabase does this automatically for all tables)

-- Optional: index for faster geo queries
CREATE INDEX IF NOT EXISTS operacao_localizacao_location_idx ON public.operacao_localizacao USING btree (latitude, longitude);

-- Trigger to update(updated_at) timestamp on changes (if needed)
CREATE OR REPLACE FUNCTION public.update_operacao_localizacao_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operacao_localizacao_update ON public.operacao_localizacao;
CREATE TRIGGER trg_operacao_localizacao_update
BEFORE INSERT OR UPDATE ON public.operacao_localizacao
FOR EACH ROW EXECUTE FUNCTION public.update_operacao_localizacao_timestamp();
