-- Migration: Adicionar colunas de cliente vinculado na tabela modelos_mensagens
-- Execute este SQL no Supabase SQL Editor

-- Adicionar colunas para vincular mensagem a um cliente específico
ALTER TABLE modelos_mensagens
ADD COLUMN IF NOT EXISTS cliente_id uuid,
ADD COLUMN IF NOT EXISTS cliente_nome text,
ADD COLUMN IF NOT EXISTS cliente_documento text;

-- Criar índice para melhorar performance de filtro por cliente
CREATE INDEX IF NOT EXISTS idx_modelos_mensagens_cliente
ON modelos_mensagens(cliente_id);