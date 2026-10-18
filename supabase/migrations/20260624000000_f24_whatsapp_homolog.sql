-- =====================================================
-- F24: WHATSAPP HOMOLOGAÇÃO — STATUS + CAMPOS
-- =====================================================

-- 1. Adicionar novos status e colunas em comunicacoes_mensagens
ALTER TABLE public.comunicacoes_mensagens
  DROP CONSTRAINT IF EXISTS comunicacoes_mensagens_status_check;

ALTER TABLE public.comunicacoes_mensagens
  ADD CONSTRAINT comunicacoes_mensagens_status_check
  CHECK (status IN (
    'rascunho','simulado','aguardando_aprovacao','aprovado',
    'bloqueado','enviado_homologacao','erro_homologacao','rejeitado'
  ));

ALTER TABLE public.comunicacoes_mensagens
  ADD COLUMN IF NOT EXISTS modo_homologacao BOOLEAN DEFAULT false;

ALTER TABLE public.comunicacoes_mensagens
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT;

ALTER TABLE public.comunicacoes_mensagens
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

ALTER TABLE public.comunicacoes_mensagens
  ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;

-- 2. Índices para novas colunas
CREATE INDEX IF NOT EXISTS idx_comunicacoes_modo_homolog
  ON public.comunicacoes_mensagens(modo_homologacao);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_motivo_bloqueio
  ON public.comunicacoes_mensagens(motivo_bloqueio);

NOTIFY pgrst, 'reload schema';
