-- =============================================================================
-- F0-K — RECIBOS (persistência real)
-- Migration mínima/aditiva. Projeto: uwrvzsjtpgaifkktpepn (PRODUÇÃO).
-- Recibo é evidência/documento — NÃO cria fato econômico (não mexe em DRE/Fluxo).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recibos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero               TEXT NOT NULL,
    data_emissao         DATE NOT NULL DEFAULT CURRENT_DATE,
    favorecido_tipo      TEXT NOT NULL DEFAULT 'outro',  -- cliente | prestador | fornecedor | outro
    favorecido_nome      TEXT NOT NULL,
    favorecido_documento TEXT,
    valor                NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_extenso        TEXT,
    referencia           TEXT,
    forma_pagamento      TEXT,
    conta_financeira     TEXT,
    os_numero            TEXT,
    observacoes          TEXT,
    status               TEXT NOT NULL DEFAULT 'emitido', -- emitido | cancelado
    motivo_cancelamento  TEXT,
    data_cancelamento    TIMESTAMPTZ,
    usuario_criador      TEXT,
    usuario_cancelou     TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recibos IS
  'F0-K — Recibos emitidos (persistidos). Recibo é evidência; não gera DRE/Fluxo.';

-- Numeração única (dois recibos nunca com o mesmo número)
CREATE UNIQUE INDEX IF NOT EXISTS uq_recibos_numero ON public.recibos (numero);

-- RLS: somente usuários autenticados
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recibos_select_auth" ON public.recibos;
CREATE POLICY "recibos_select_auth" ON public.recibos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recibos_insert_auth" ON public.recibos;
CREATE POLICY "recibos_insert_auth" ON public.recibos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "recibos_update_auth" ON public.recibos;
CREATE POLICY "recibos_update_auth" ON public.recibos
  FOR UPDATE TO authenticated USING (true);
