-- Migration: Adiciona colunas de separação financeira (Valor Cliente x Prestador)
-- na tabela tabelas_valores para a Escala Operacional

-- 1. Adicionar coluna valor_cliente (quanto a empresa cobra do cliente)
ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS valor_cliente numeric DEFAULT 0;

-- 2. Adicionar coluna tipo_repasse_prestador (percentual ou fixo)
ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS tipo_repasse_prestador text DEFAULT 'percentual'
CHECK (tipo_repasse_prestador IN ('percentual', 'fixo'));

-- 3. Adicionar coluna valor_fixo_prestador (valor fixo do repasse)
ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS valor_fixo_prestador numeric DEFAULT 0;

-- Comentários
COMMENT ON COLUMN public.tabelas_valores.valor_cliente IS 'Valor cobrado do cliente (faturamento)';
COMMENT ON COLUMN public.tabelas_valores.tipo_repasse_prestador IS 'Tipo de cálculo do repasse do prestador: percentual ou fixo';
COMMENT ON COLUMN public.tabelas_valores.valor_fixo_prestador IS 'Valor fixo do repasse do prestador (quando tipo_repasse_prestador = fixo)';
