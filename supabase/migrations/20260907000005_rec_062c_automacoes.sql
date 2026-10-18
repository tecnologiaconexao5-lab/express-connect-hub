-- ============================================================================
-- REC-06.2C — Tabela recrutamento_automacoes + RLS
-- Conexão Express TMS
-- Data: 2026-09-07
-- ============================================================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.recrutamento_automacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email', 'notificacao', 'webhook', 'score', 'validade_documento')),
  trigger JSONB NOT NULL DEFAULT '{}'::jsonb,
  acao JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'desativada')),
  ultima_execucao TIMESTAMPTZ,
  total_execucoes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_rec_automacoes_status ON public.recrutamento_automacoes(status);
CREATE INDEX IF NOT EXISTS idx_rec_automacoes_tipo ON public.recrutamento_automacoes(tipo);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION public.f_rec_automacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rec_automacoes_updated_at ON public.recrutamento_automacoes;
CREATE TRIGGER trg_rec_automacoes_updated_at
  BEFORE UPDATE ON public.recrutamento_automacoes
  FOR EACH ROW EXECUTE FUNCTION f_rec_automacoes_updated_at();

-- 4. Habilitar RLS
ALTER TABLE public.recrutamento_automacoes ENABLE ROW LEVEL SECURITY;

-- 5. Remover policies antigas (idempotente)
DROP POLICY IF EXISTS rec_automacoes_select ON public.recrutamento_automacoes;
DROP POLICY IF EXISTS rec_automacoes_insert ON public.recrutamento_automacoes;
DROP POLICY IF EXISTS rec_automacoes_update ON public.recrutamento_automacoes;
DROP POLICY IF EXISTS rec_automacoes_delete ON public.recrutamento_automacoes;

-- 6. Criar policies — authenticated apenas
CREATE POLICY rec_automacoes_select
  ON public.recrutamento_automacoes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY rec_automacoes_insert
  ON public.recrutamento_automacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY rec_automacoes_update
  ON public.recrutamento_automacoes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY rec_automacoes_delete
  ON public.recrutamento_automacoes
  FOR DELETE
  TO authenticated
  USING (true);

-- 7. Revogar acesso anon (defense-in-depth)
REVOKE ALL ON public.recrutamento_automacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recrutamento_automacoes TO authenticated;

-- ============================================================================
-- FIM — REC-06.2C
-- ============================================================================
