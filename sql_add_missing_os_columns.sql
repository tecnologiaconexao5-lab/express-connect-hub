-- Migration to add missing columns from OS form payload that were failing the save operation

ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS pedido_interno TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS ref_cliente TEXT;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS sla_operacao TEXT;

-- Opcional: Se for salvar dados flexíveis como metadata:
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
