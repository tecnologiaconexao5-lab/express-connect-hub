CREATE TABLE IF NOT EXISTS crm_interacoes_prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id UUID NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  prestador_nome TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL CHECK (tipo IN ('ligacao', 'whatsapp', 'email', 'reuniao', 'visita', 'observacao', 'proposta_enviada', 'retorno_prestador')),
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT NOT NULL DEFAULT '',
  proxima_acao TEXT NOT NULL DEFAULT '',
  data_proximo_contato TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('agendado', 'realizado', 'cancelado', 'pendente')),
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_interacoes_prestador_id ON crm_interacoes_prestadores(prestador_id);
CREATE INDEX IF NOT EXISTS idx_crm_interacoes_data ON crm_interacoes_prestadores(data DESC);

ALTER TABLE crm_interacoes_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON crm_interacoes_prestadores;
CREATE POLICY "authenticated_select" ON crm_interacoes_prestadores
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert" ON crm_interacoes_prestadores;
CREATE POLICY "authenticated_insert" ON crm_interacoes_prestadores
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update" ON crm_interacoes_prestadores;
CREATE POLICY "authenticated_update" ON crm_interacoes_prestadores
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_delete" ON crm_interacoes_prestadores;
CREATE POLICY "authenticated_delete" ON crm_interacoes_prestadores
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "anon_select" ON crm_interacoes_prestadores;
CREATE POLICY "anon_select" ON crm_interacoes_prestadores
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON crm_interacoes_prestadores;
CREATE POLICY "anon_insert" ON crm_interacoes_prestadores
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON crm_interacoes_prestadores;
CREATE POLICY "anon_update" ON crm_interacoes_prestadores
  FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "anon_delete" ON crm_interacoes_prestadores;
CREATE POLICY "anon_delete" ON crm_interacoes_prestadores
  FOR DELETE TO anon USING (true);


