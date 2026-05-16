-- ============================================================
-- MIGRAÇÃO: CRM Real — Adicionar colunas faltantes em crm_leads
-- + Criar crm_historico e crm_followups se não existirem
-- Correção 3b — 2026-05-15
-- ============================================================

-- ─── 1. Adicionar colunas faltantes em crm_leads ─────────────
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS empresa TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_contato TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS segmento TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS regiao TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS responsavel TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_servico TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS estagio TEXT DEFAULT 'lead_novo',
  ADD COLUMN IF NOT EXISTS urgencia TEXT DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS temperatura TEXT DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS valor_estimado_mensal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS probabilidade_fechamento INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS qtd_veiculos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipos_veiculo TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regioes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS volume_mensal INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lembretes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dias_na_etapa INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
  ADD COLUMN IF NOT EXISTS descricao_perda TEXT,
  ADD COLUMN IF NOT EXISTS proposta_url TEXT,
  ADD COLUMN IF NOT EXISTS proposta_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposta_visualizacoes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS orcamento_id UUID,
  ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS proximo_followup TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── 2. crm_historico ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'atualizacao',
  titulo TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. crm_followups ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  canal TEXT DEFAULT 'email',
  tipo TEXT DEFAULT 'primeiro_contato',
  assunto TEXT DEFAULT '',
  mensagem TEXT DEFAULT '',
  status TEXT DEFAULT 'pendente',
  agendado_para TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. Índices ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_leads_estagio ON crm_leads(estagio);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON crm_leads(responsavel);
CREATE INDEX IF NOT EXISTS idx_crm_historico_lead_id ON crm_historico(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_lead_id ON crm_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_status ON crm_followups(status);

-- ─── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE crm_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_historico' AND policyname = 'allow_all_crm_historico') THEN
    CREATE POLICY allow_all_crm_historico ON crm_historico FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_followups' AND policyname = 'allow_all_crm_followups') THEN
    CREATE POLICY allow_all_crm_followups ON crm_followups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- ─── 6. Verificação ──────────────────────────────────────────
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('crm_leads', 'crm_historico', 'crm_followups')
  AND column_name IN ('estagio', 'empresa', 'lead_id', 'assunto', 'titulo')
ORDER BY table_name, column_name;
