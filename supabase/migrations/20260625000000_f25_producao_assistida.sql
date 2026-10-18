-- =====================================================
-- F25: PRODUÇÃO ASSISTIDA — TABELAS E CONFIGURAÇÕES
-- =====================================================

-- 1. DESTINATÁRIOS AUTORIZADOS
CREATE TABLE IF NOT EXISTS public.comunicacoes_destinatarios_autorizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_destinatario TEXT NOT NULL CHECK (tipo_destinatario IN ('cliente','prestador','candidato','interno')),
  origem_id TEXT,
  nome TEXT,
  telefone TEXT,
  canal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','email','sms')),
  setor TEXT NOT NULL DEFAULT 'operacional',
  permitido BOOLEAN DEFAULT false,
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao_assistida','producao')),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dest_autorizados_tipo ON public.comunicacoes_destinatarios_autorizados(tipo_destinatario);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_ambiente ON public.comunicacoes_destinatarios_autorizados(ambiente);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_permitido ON public.comunicacoes_destinatarios_autorizados(permitido);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_setor ON public.comunicacoes_destinatarios_autorizados(setor);

-- 2. RLS
ALTER TABLE public.comunicacoes_destinatarios_autorizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dest_autorizados_admin_all" ON public.comunicacoes_destinatarios_autorizados;
CREATE POLICY "dest_autorizados_admin_all" ON public.comunicacoes_destinatarios_autorizados
  FOR ALL USING (true) WITH CHECK (true);

-- 3. PERMISSÕES
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicacoes_destinatarios_autorizados TO anon, authenticated;

-- 4. Índices únicos para evitar duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_dest_autorizados_unique
  ON public.comunicacoes_destinatarios_autorizados(tipo_destinatario, COALESCE(origem_id, ''), canal, setor, ambiente);

NOTIFY pgrst, 'reload schema';
