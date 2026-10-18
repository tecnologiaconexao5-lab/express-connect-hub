-- ==========================================================================
-- REC-02: CONSOLIDACAO DE ENTIDADES + TENANT ISOLATION
-- Data: 2026-08-31
-- Status: NAO APLICADA — requer autorizacao
--
-- Padrão copiado de: 20260626_missao16_multitenant_rls_p0.sql
-- Default: current_tenant_id_safe()
-- RLS: 4 policies (SELECT anon+auth, INSERT/UPDATE/DELETE auth only)
--
-- Tabelas cobertas:
--   1. recrutamento_candidatos (pipeline enterprise)
--   2. recrutamento_prestadores (recruitment version)
--   3. recrutamento_operacoes (campanhas/vagas)
--   4. candidatos (legacy, still active)
--   5. operacoes (minimal)
--   6. homologacoes
--   7. crm_interacoes_prestadores
--   8. fluxo_recrutamento
--   9. match_operacoes_prestadores
--  10. provider_documents
--  11. reservas_banco (phantom — code references it)
--  12. liberado_app_audit (from REC-01)
--
-- SEGURANCA:
--   - NENHUM DROP destrutivo
--   - NENHUM DELETE de dados
--   - Backfill com DEFAULT tenant (00000000-...)
--   - Rollback reversivel em cada secao
-- ==========================================================================

-- ── SECAO A: Funcao auxiliar idempotente ─────────────────────────────────
-- Cria politica RLS de forma segura (ignora se ja existe)
CREATE OR REPLACE FUNCTION _rec02_create_policy_if_not_exists(
  p_table TEXT,
  p_name TEXT,
  p_cmd TEXT,
  p_roles TEXT,
  p_using TEXT,
  p_check TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = p_table
      AND schemaname = 'public'
      AND policyname = p_name
  ) THEN
    IF p_check IS NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO %s USING (%s)',
        p_name, p_table, p_cmd, p_roles, p_using
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO %s WITH CHECK (%s)',
        p_name, p_table, p_cmd, p_roles, p_check
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── SECAO B: Helper para adicionar tenant_id + RLS ──────────────────────
CREATE OR REPLACE FUNCTION _rec02_add_tenant_isolation(
  p_table TEXT,
  p_prefix TEXT
) RETURNS void AS $$
BEGIN
  -- 1. Add tenant_id column (idempotent)
  EXECUTE format(
    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe()',
    p_table
  );

  -- 2. Backfill NULL tenant_id with default tenant
  EXECUTE format(
    'UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000001''::uuid WHERE tenant_id IS NULL',
    p_table
  );

  -- 3. NOT NULL constraint (safe after backfill)
  EXECUTE format(
    'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
    p_table
  );

  -- 4. Foreign key to tenants (idempotent)
  BEGIN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT fk_%s_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE',
      p_table, p_prefix
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- 5. Index (idempotent)
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_tenant ON public.%I(tenant_id)',
    p_prefix, p_table
  );

  -- 6. Enable RLS
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);

  -- 7. Drop old permissive policies (anon access, USING true, etc.)
  -- We drop policies that are NOT our new tenant-scoped ones
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_select', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_insert', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_update', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_delete', p_table
  );

  -- Also drop any anon policies from REC-01 or M0601
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_select_anon', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_insert_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_update_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_delete_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    p_prefix || '_select_auth', p_table
  );

  -- Drop REC-01 policies
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rc_select_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rc_insert_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rc_update_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rc_delete_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rp_select_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rp_insert_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rp_update_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'rp_delete_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'ro_select_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'ro_insert_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'ro_update_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'ro_delete_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'op_select_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'op_insert_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'op_update_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'op_delete_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'hom_select', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'hom_insert', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'hom_update', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'hom_delete', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'fr_select', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'fr_insert', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'fr_update', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'fr_delete', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'pd_select', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'pd_insert', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'pd_update', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'pd_delete', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'mop_select_auth', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'mop_insert_auth', p_table
  );
  -- Drop candidatos anon policies (from M0601)
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'candidatos_select', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'candidatos_insert', p_table
  );
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON public.%I',
    'candidatos_update', p_table
  );

  -- 8. Create standard 4 policies (tenant-scoped)
  PERFORM _rec02_create_policy_if_not_exists(
    p_table, p_prefix || '_select_tenant', 'SELECT',
    'anon, authenticated',
    format('(tenant_id = public.current_tenant_id_safe())')
  );
  PERFORM _rec02_create_policy_if_not_exists(
    p_table, p_prefix || '_insert_tenant', 'INSERT',
    'authenticated',
    format('(tenant_id = public.current_tenant_id_safe())')
  );
  PERFORM _rec02_create_policy_if_not_exists(
    p_table, p_prefix || '_update_tenant', 'UPDATE',
    'authenticated',
    format('(tenant_id = public.current_tenant_id_safe())')
  );
  PERFORM _rec02_create_policy_if_not_exists(
    p_table, p_prefix || '_delete_tenant', 'DELETE',
    'authenticated',
    format('(tenant_id = public.current_tenant_id_safe())')
  );
END;
$$ LANGUAGE plpgsql;


-- ==========================================================================
-- SECAO C: Aplicar tenant isolation em cada tabela
-- ==========================================================================

-- 1. recrutamento_candidatos (Pipeline Enterprise)
SELECT _rec02_add_tenant_isolation('recrutamento_candidatos', 'rc');

-- 2. recrutamento_prestadores (Recruitment version)
SELECT _rec02_add_tenant_isolation('recrutamento_prestadores', 'rp');

-- 3. recrutamento_operacoes (Campanhas/Vagas)
SELECT _rec02_add_tenant_isolation('recrutamento_operacoes', 'ro');

-- 4. candidatos (Legacy — still active)
SELECT _rec02_add_tenant_isolation('candidatos', 'ca');

-- 5. operacoes (Minimal)
SELECT _rec02_add_tenant_isolation('operacoes', 'op');

-- 6. homologacoes
SELECT _rec02_add_tenant_isolation('homologacoes', 'hom');

-- 7. crm_interacoes_prestadores (already has tenant_usuarios guard via M06/M01)
--    Override: drop old guard policies, add standard tenant_id
--    NOTE: This table already has cip_select_tms, cip_insert_tms etc from M06
--    We need to drop those and replace with standard pattern
DROP POLICY IF EXISTS cip_select_tms ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS cip_insert_tms ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS cip_update_tms ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS cip_delete_tms ON public.crm_interacoes_prestadores;
SELECT _rec02_add_tenant_isolation('crm_interacoes_prestadores', 'cip');

-- 8. fluxo_recrutamento
SELECT _rec02_add_tenant_isolation('fluxo_recrutamento', 'fr');

-- 9. match_operacoes_prestadores
--    Already has mop_select_auth, mop_insert_auth from REC-01
SELECT _rec02_add_tenant_isolation('match_operacoes_prestadores', 'mop');

-- 10. provider_documents
SELECT _rec02_add_tenant_isolation('provider_documents', 'pd');

-- 11. reservas_banco (phantom table — code references it, may not exist)
--     Use IF EXISTS to avoid errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservas_banco' AND table_schema = 'public') THEN
    PERFORM _rec02_add_tenant_isolation('reservas_banco', 'rb');
  ELSE
    -- Create the table with tenant_id from the start
    CREATE TABLE public.reservas_banco (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      candidato_id UUID REFERENCES public.candidatos(id) ON DELETE CASCADE,
      data_reserva DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'pendente',
      tipo_veiculo TEXT,
      regiao TEXT,
      tenant_id UUID NOT NULL DEFAULT public.current_tenant_id_safe() REFERENCES public.tenants(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rb_tenant ON public.reservas_banco(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_rb_candidato ON public.reservas_banco(candidato_id);
    ALTER TABLE public.reservas_banco ENABLE ROW LEVEL SECURITY;
    PERFORM _rec02_create_policy_if_not_exists(
      'reservas_banco', 'rb_select_tenant', 'SELECT',
      'anon, authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
    PERFORM _rec02_create_policy_if_not_exists(
      'reservas_banco', 'rb_insert_tenant', 'INSERT',
      'authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
    PERFORM _rec02_create_policy_if_not_exists(
      'reservas_banco', 'rb_update_tenant', 'UPDATE',
      'authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
    PERFORM _rec02_create_policy_if_not_exists(
      'reservas_banco', 'rb_delete_tenant', 'DELETE',
      'authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
  END IF;
END $$;

-- 12. liberado_app_audit (from REC-01 — add tenant_id if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liberado_app_audit' AND table_schema = 'public') THEN
    PERFORM _rec02_add_tenant_isolation('liberado_app_audit', 'laa');
    -- Also drop the old tenant_usuarios guard policies from REC-01
    DROP POLICY IF EXISTS laa_select_tms ON public.liberado_app_audit;
    DROP POLICY IF EXISTS laa_insert_service ON public.liberado_app_audit;
    -- Re-create standard policies
    PERFORM _rec02_create_policy_if_not_exists(
      'liberado_app_audit', 'laa_select_tenant', 'SELECT',
      'anon, authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
    PERFORM _rec02_create_policy_if_not_exists(
      'liberado_app_audit', 'laa_insert_tenant', 'INSERT',
      'authenticated', '(tenant_id = public.current_tenant_id_safe())'
    );
  END IF;
END $$;


-- ==========================================================================
-- SECAO D: Marcar tabelas legacy como deprecated (comentario)
-- ==========================================================================

COMMENT ON TABLE public.candidatos IS
  'LEGACY — fonte original de candidatos. Substituir por recrutamento_candidatos para Dashboard ePipeline. Mantido para compatibilidade com recrutamentoIA, recrutamentoIntegracao, Homologacao, BancoReservas, AcompanhamentoDocs.';

COMMENT ON TABLE public.recrutamento_prestadores IS
  'DEPRECATED — versao de recrutamento de prestadores. Usado apenas por prestadoresService.ts (recrutamento module). A entidade mestra e prestadores ( tabela principal ).';

COMMENT ON TABLE public.recrutamento_operacoes IS
  'LEGACY — sem leitores ou escritores ativos no codigo. Nao utilizada por nenhuma rota.';

COMMENT ON TABLE public.operacoes IS
  'MINIMAL — apenas leitura do Dashboard (contagem). Usar recrutamento_operacoes como fonte canonica.';

COMMENT ON TABLE public.provider_documents IS
  'DEPRECATED — alternativa a documentos_prestadores. Apenas AnaliseLote.tsx le. Unificar com documentos_prestadores.';


-- ==========================================================================
-- SECAO E: Cleanup helpers (drop functions after use)
-- ==========================================================================

DROP FUNCTION IF EXISTS _rec02_create_policy_if_not_exists(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS _rec02_add_tenant_isolation(TEXT, TEXT);
