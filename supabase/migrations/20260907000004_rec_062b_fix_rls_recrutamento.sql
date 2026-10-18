-- ═══════════════════════════════════════════════════════════════════════════════
-- REC-06.2B — Fix RLS Recrutamento
-- Data: 2026-09-07
-- Escopo: recrutamento_operacoes (vulnerável) + crm_interacoes_prestadores (sem DELETE)
-- Reversível: sim (rollback no final)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. recrutamento_operacoes — remover anon das policies
--    ANTES: roles={authenticated,anon}, USING=true (VULNERÁVEL)
--    DEPOIS: roles={authenticated}, USING=auth.role()='authenticated'
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS recrutamento_operacoes_select ON recrutamento_operacoes;
DROP POLICY IF EXISTS recrutamento_operacoes_insert ON recrutamento_operacoes;
DROP POLICY IF EXISTS recrutamento_operacoes_update ON recrutamento_operacoes;
DROP POLICY IF EXISTS recrutamento_operacoes_delete ON recrutamento_operacoes;

CREATE POLICY recrutamento_operacoes_select ON recrutamento_operacoes
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY recrutamento_operacoes_insert ON recrutamento_operacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY recrutamento_operacoes_update ON recrutamento_operacoes
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY recrutamento_operacoes_delete ON recrutamento_operacoes
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. crm_interacoes_prestadores — adicionar policy DELETE (missing)
--    ANTES: 3 policies (select/insert/update), sem DELETE
--    DEPOIS: 4 policies (select/insert/update/delete)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS cip_delete_tms ON crm_interacoes_prestadores;

CREATE POLICY cip_delete_tms ON crm_interacoes_prestadores
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_usuarios
      WHERE tenant_usuarios.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. REVOKE anon grants (defense-in-depth)
--    Mesmo que policies já bloqueiem, revoke é camada extra
-- ═══════════════════════════════════════════════════════════════════════════════

REVOKE ALL ON recrutamento_operacoes FROM anon;
REVOKE ALL ON crm_interacoes_prestadores FROM anon;
REVOKE ALL ON recrutamento_prestadores FROM anon;
REVOKE ALL ON recrutamento_candidatos FROM anon;
REVOKE ALL ON candidato_documentos FROM anon;

COMMIT;
