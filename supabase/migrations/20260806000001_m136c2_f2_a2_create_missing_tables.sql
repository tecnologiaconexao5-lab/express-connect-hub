-- ══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 136-C.2-F2-A2 — CREATE 8 TABELAS FALTANTES
--
-- 8 tabelas que são consultadas pelo frontend mas NUNCA foram criadas
-- no banco de dados (produzem HTTP 404 silenciosos em network logs).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ============================================================
-- 1. convites — Convites para novos usuários/tenants
--    Usado por: AcceptInvite.tsx, adminTenantsService.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS convites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  papel       TEXT NOT NULL DEFAULT 'admin_tenant',
  token       UUID DEFAULT gen_random_uuid() UNIQUE,
  usado       BOOLEAN DEFAULT false,
  expira_em   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  criado_por  UUID,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. despesas_operacionais — Despesas de frota (combustível,
--    manutenção, etc.)
--    Usado por: DREGerencial.tsx, frotaService.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS despesas_operacionais (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id        UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  categoria         TEXT NOT NULL DEFAULT 'outros',
  subcategoria      TEXT,
  descricao         TEXT,
  valor             NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_competencia  DATE NOT NULL DEFAULT CURRENT_DATE,
  status            TEXT NOT NULL DEFAULT 'pendente',
  comprovante_url   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. provider_documents — Documentos de prestadores
--    Usado por: AnaliseLote.tsx
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_documents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id  UUID REFERENCES prestadores(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL DEFAULT 'outros',
  status        TEXT NOT NULL DEFAULT 'pendente',
  validade      DATE,
  url           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. modelos_mensagens — Templates de mensagens rápidas
--    Usado por: Biblioteca.tsx, GeradorAnuncioWhatsApp.tsx
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_mensagens (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo            TEXT NOT NULL,
  categoria         TEXT DEFAULT 'geral',
  texto             TEXT,
  cliente_id        UUID,
  cliente_nome      TEXT,
  cliente_documento TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. biblioteca_documentos — Metadados de documentos enviados
--    ao Storage
--    Usado por: Biblioteca.tsx
-- ============================================================
CREATE TABLE IF NOT EXISTS biblioteca_documentos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  caminho       TEXT,
  url           TEXT,
  tamanho       TEXT,
  categoria     TEXT DEFAULT 'Geral',
  pasta         TEXT NOT NULL DEFAULT 'geral',
  cliente_id    UUID,
  prestador_id  UUID,
  usuario_nome  TEXT DEFAULT 'Sistema',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. fluxo_recrutamento — Etapas do fluxo de recrutamento
--    Usado por: Biblioteca.tsx
-- ============================================================
CREATE TABLE IF NOT EXISTS fluxo_recrutamento (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      TEXT NOT NULL,
  texto       TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. homologacoes — Registro de homologação de candidatos
--    Usado por: Homologacao.tsx, useDashboardRecrutamento.ts,
--               recrutamentoIntegracao.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS homologacoes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidato_id      UUID,
  data_homologacao  TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente',
  obs               TEXT,
  checklist         JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. operacoes — Operações/rotas de recrutamento
--    Usado por: useDashboardRecrutamento.ts
-- ============================================================
CREATE TABLE IF NOT EXISTS operacoes (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                  TEXT NOT NULL,
  regiao_carregamento   TEXT,
  veiculo               TEXT,
  status                TEXT NOT NULL DEFAULT 'ativo',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS — Todas as 8 tabelas: authenticated pode CRUD
-- ============================================================
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE biblioteca_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_recrutamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE homologacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operacoes ENABLE ROW LEVEL SECURITY;

-- Convites
DROP POLICY IF EXISTS "convites_select" ON convites;
CREATE POLICY "convites_select" ON convites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "convites_insert" ON convites;
CREATE POLICY "convites_insert" ON convites FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "convites_delete" ON convites;
CREATE POLICY "convites_delete" ON convites FOR DELETE TO authenticated USING (true);

-- Despesas operacionais
DROP POLICY IF EXISTS "despesas_select" ON despesas_operacionais;
CREATE POLICY "despesas_select" ON despesas_operacionais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "despesas_insert" ON despesas_operacionais;
CREATE POLICY "despesas_insert" ON despesas_operacionais FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "despesas_update" ON despesas_operacionais;
CREATE POLICY "despesas_update" ON despesas_operacionais FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "despesas_delete" ON despesas_operacionais;
CREATE POLICY "despesas_delete" ON despesas_operacionais FOR DELETE TO authenticated USING (true);

-- Provider documents
DROP POLICY IF EXISTS "pd_select" ON provider_documents;
CREATE POLICY "pd_select" ON provider_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pd_insert" ON provider_documents;
CREATE POLICY "pd_insert" ON provider_documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pd_update" ON provider_documents;
CREATE POLICY "pd_update" ON provider_documents FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "pd_delete" ON provider_documents;
CREATE POLICY "pd_delete" ON provider_documents FOR DELETE TO authenticated USING (true);

-- Modelos mensagens
DROP POLICY IF EXISTS "mm_select" ON modelos_mensagens;
CREATE POLICY "mm_select" ON modelos_mensagens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mm_insert" ON modelos_mensagens;
CREATE POLICY "mm_insert" ON modelos_mensagens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mm_update" ON modelos_mensagens;
CREATE POLICY "mm_update" ON modelos_mensagens FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "mm_delete" ON modelos_mensagens;
CREATE POLICY "mm_delete" ON modelos_mensagens FOR DELETE TO authenticated USING (true);

-- Biblioteca documentos
DROP POLICY IF EXISTS "bd_select" ON biblioteca_documentos;
CREATE POLICY "bd_select" ON biblioteca_documentos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bd_insert" ON biblioteca_documentos;
CREATE POLICY "bd_insert" ON biblioteca_documentos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bd_update" ON biblioteca_documentos;
CREATE POLICY "bd_update" ON biblioteca_documentos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "bd_delete" ON biblioteca_documentos;
CREATE POLICY "bd_delete" ON biblioteca_documentos FOR DELETE TO authenticated USING (true);

-- Fluxo recrutamento
DROP POLICY IF EXISTS "fr_select" ON fluxo_recrutamento;
CREATE POLICY "fr_select" ON fluxo_recrutamento FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fr_insert" ON fluxo_recrutamento;
CREATE POLICY "fr_insert" ON fluxo_recrutamento FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "fr_update" ON fluxo_recrutamento;
CREATE POLICY "fr_update" ON fluxo_recrutamento FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "fr_delete" ON fluxo_recrutamento;
CREATE POLICY "fr_delete" ON fluxo_recrutamento FOR DELETE TO authenticated USING (true);

-- Homologacoes
DROP POLICY IF EXISTS "hom_select" ON homologacoes;
CREATE POLICY "hom_select" ON homologacoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hom_insert" ON homologacoes;
CREATE POLICY "hom_insert" ON homologacoes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "hom_update" ON homologacoes;
CREATE POLICY "hom_update" ON homologacoes FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "hom_delete" ON homologacoes;
CREATE POLICY "hom_delete" ON homologacoes FOR DELETE TO authenticated USING (true);

-- Operacoes
DROP POLICY IF EXISTS "op_select" ON operacoes;
CREATE POLICY "op_select" ON operacoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "op_insert" ON operacoes;
CREATE POLICY "op_insert" ON operacoes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "op_update" ON operacoes;
CREATE POLICY "op_update" ON operacoes FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "op_delete" ON operacoes;
CREATE POLICY "op_delete" ON operacoes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Índices básicos
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_convites_tenant ON convites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_convites_email ON convites(email);
CREATE INDEX IF NOT EXISTS idx_desp_oper_veiculo ON despesas_operacionais(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_desp_oper_competencia ON despesas_operacionais(data_competencia);
CREATE INDEX IF NOT EXISTS idx_desp_oper_categoria ON despesas_operacionais(categoria);
CREATE INDEX IF NOT EXISTS idx_provider_docs_prestador ON provider_documents(prestador_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_pasta ON biblioteca_documentos(pasta);
CREATE INDEX IF NOT EXISTS idx_fluxo_recrutamento_ordem ON fluxo_recrutamento(ordem);
CREATE INDEX IF NOT EXISTS idx_homologacoes_candidato ON homologacoes(candidato_id);

COMMIT;
