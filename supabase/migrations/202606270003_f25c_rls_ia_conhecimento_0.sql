-- ============================================================
-- MIGRATION: 20260627_f25c_rls_ia_conhecimento
-- PROJETO: TMS Conexão Express Hub
-- DESCRIÇÃO: Adiciona RLS policies para ia_conhecimento
-- (a tabela foi criada sem RLS policies, impossibilitando
--  acesso via anon key mesmo com usuário autenticado)
-- ============================================================

-- Policy para usuários autenticados (full CRUD)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_conhecimento_admin_all' AND tablename = 'ia_conhecimento') THEN
    CREATE POLICY ia_conhecimento_admin_all ON ia_conhecimento
      FOR ALL TO public
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Policy para usuários anônimos (leitura/escrita)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_conhecimento_anon_all' AND tablename = 'ia_conhecimento') THEN
    CREATE POLICY ia_conhecimento_anon_all ON ia_conhecimento
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
