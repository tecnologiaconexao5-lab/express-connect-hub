-- ============================================================
-- MIGRAÇÃO: CRM Real — Tabelas crm_leads, crm_historico, crm_followups
-- Correção 3 — 2026-05-15
-- Execute via: supabase db push
-- ============================================================

-- ─── 1. crm_leads ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  empresa TEXT NOT NULL DEFAULT '',
  nome_contato TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  -- Classificação
  segmento TEXT DEFAULT '',
  regiao TEXT DEFAULT '',
  origem TEXT DEFAULT 'outro',
  responsavel TEXT DEFAULT '',
  tipo_servico TEXT DEFAULT '',
  -- Pipeline
  estagio TEXT DEFAULT 'lead_novo',
  urgencia TEXT DEFAULT 'media',
  temperatura TEXT DEFAULT 'frio',
  -- Financeiro
  valor_estimado_mensal NUMERIC DEFAULT 0,
  probabilidade_fechamento INTEGER DEFAULT 10,
  -- Operacional
  qtd_veiculos INTEGER DEFAULT 0,
  tipos_veiculo TEXT[] DEFAULT '{}',
  regioes TEXT[] DEFAULT '{}',
  volume_mensal INTEGER DEFAULT 0,
  -- Histórico e agenda
  timeline JSONB DEFAULT '[]',
  lembretes JSONB DEFAULT '[]',
  -- Metadados
  dias_na_etapa INTEGER DEFAULT 0,
  -- Perda
  motivo_perda TEXT,
  descricao_perda TEXT,
  -- Proposta
  proposta_url TEXT,
  proposta_enviada_em TIMESTAMPTZ,
  proposta_visualizacoes INTEGER DEFAULT 0,
  -- Vínculos
  cliente_id UUID,
  orcamento_id UUID,
  -- Observações
  observacoes TEXT DEFAULT '',
  -- Timestamps
  proximo_followup TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. crm_historico ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'atualizacao',
  titulo TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. crm_followups ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
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

-- ─── 4. Índices (movidos para migration 3b que faz o ALTER TABLE) ────────────
-- Os índices serão criados na migration 20260515_correcao_3b_crm_alter.sql
-- após as colunas serem adicionadas via ADD COLUMN IF NOT EXISTS

-- ─── 5. RLS (Row Level Security) ─────────────────────────────
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;

-- Policies: acesso total para usuários autenticados (mesmo padrão do projeto)
DO $$
BEGIN
  -- crm_leads
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'allow_all_authenticated') THEN
    CREATE POLICY allow_all_authenticated ON crm_leads
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- crm_leads anon read (para dev sem auth)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'allow_anon_read') THEN
    CREATE POLICY allow_anon_read ON crm_leads
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- crm_historico
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_historico' AND policyname = 'allow_all_authenticated') THEN
    CREATE POLICY allow_all_authenticated ON crm_historico
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_historico' AND policyname = 'allow_anon_read') THEN
    CREATE POLICY allow_anon_read ON crm_historico
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- crm_followups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_followups' AND policyname = 'allow_all_authenticated') THEN
    CREATE POLICY allow_all_authenticated ON crm_followups
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_followups' AND policyname = 'allow_anon_read') THEN
    CREATE POLICY allow_anon_read ON crm_followups
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- ─── 6. Verificação ──────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('crm_leads', 'crm_historico', 'crm_followups')
ORDER BY table_name;
