-- Migration: Prestadores, Veículos e Ocorrências Fix
-- Execute este SQL no Supabase SQL Editor

-- ============================================
-- TABELA PRESTADORES
-- ============================================

-- Colunas básicas de identificação
ALTER TABLE prestadores
ADD COLUMN IF NOT EXISTS rg_ie text,
ADD COLUMN IF NOT EXISTS foto text,
ADD COLUMN IF NOT EXISTS regiao_principal text,
ADD COLUMN IF NOT EXISTS regioes_secundarias text[],
ADD COLUMN IF NOT EXISTS valor_diaria numeric(10,2);

-- ============================================
-- TABELA VEÍCULOS
-- ============================================

ALTER TABLE veiculos
ADD COLUMN IF NOT EXISTS prestador_vinculado uuid REFERENCES prestadores(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS placa text,
ADD COLUMN IF NOT EXISTS tipo text,
ADD COLUMN IF NOT EXISTS marca text,
ADD COLUMN IF NOT EXISTS modelo text,
ADD COLUMN IF NOT EXISTS ano integer,
ADD COLUMN IF NOT EXISTS renavam text,
ADD COLUMN IF NOT EXISTS antt text,
ADD COLUMN IF NOT EXISTS proprietario_nome text,
ADD COLUMN IF NOT EXISTS proprietario_documento text,
ADD COLUMN IF NOT EXISTS capacidade_kg numeric(10,2),
ADD COLUMN IF NOT EXISTS capacidade_m3 numeric(10,2),
ADD COLUMN IF NOT EXISTS comprimento_m numeric(10,2),
ADD COLUMN IF NOT EXISTS largura_m numeric(10,2),
ADD COLUMN IF NOT EXISTS altura_m numeric(10,2),
ADD COLUMN IF NOT EXISTS tipo_carga text,
ADD COLUMN IF NOT EXISTS temperatura_min numeric(10,2),
ADD COLUMN IF NOT EXISTS temperatura_max numeric(10,2),
ADD COLUMN IF NOT EXISTS rastreador boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS seguro boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS restricoes_regiao text,
ADD COLUMN IF NOT EXISTS observacoes text,
ADD COLUMN IF NOT EXISTS principal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- ============================================
-- TABELA OCORRÊNCIAS DE PRESTADORES
-- ============================================

CREATE TABLE IF NOT EXISTS prestadores_ocorrencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
    data date DEFAULT current_date,
    tipo text,
    gravidade text,
    status text DEFAULT 'aberta',
    descricao text,
    registrado_por text DEFAULT 'Sistema',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_veiculos_prestador_vinculado
ON veiculos(prestador_vinculado);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador
ON prestadores_ocorrencias(prestador_id);