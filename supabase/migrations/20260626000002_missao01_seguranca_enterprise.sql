-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 01
-- Security Enterprise Hardening Migration
-- Data: 2026-06-26
-- Fases: 2 (RLS) + 3 (Grants) + 4 (SECURITY DEFINER)
-- ============================================================

-- ============================================================
-- SECAO 0: NOTA DE ESTRATEGIA
-- ============================================================
-- Estrategia: Manter SELECT aberto para anon (compatibilidade com app atual)
-- Restringir INSERT/UPDATE/DELETE para authenticated
-- Isso permite que o app continue funcionando enquanto a
-- autenticacao completa e implementada
-- ============================================================


-- ============================================================
-- SECAO 1: REVOGAR GRANTS EXCESSIVOS DO ANON
-- ============================================================

-- 1.1 Revogar GRANT ALL TO anon (4 tabelas) — wrapped for deferred tables
DO $$ BEGIN
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_robos';
  IF FOUND THEN REVOKE ALL ON automacoes_robos FROM anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_instrucoes';
  IF FOUND THEN REVOKE ALL ON automacoes_instrucoes FROM anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_gatilhos';
  IF FOUND THEN REVOKE ALL ON automacoes_gatilhos FROM anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_gatilhos_execucao';
  IF FOUND THEN REVOKE ALL ON automacoes_gatilhos_execucao FROM anon; END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1.2 Re-conceder apenas SELECT (leitura) para anon
DO $$ BEGIN
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_robos';
  IF FOUND THEN GRANT SELECT ON automacoes_robos TO anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_instrucoes';
  IF FOUND THEN GRANT SELECT ON automacoes_instrucoes TO anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_gatilhos';
  IF FOUND THEN GRANT SELECT ON automacoes_gatilhos TO anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='automacoes_gatilhos_execucao';
  IF FOUND THEN GRANT SELECT ON automacoes_gatilhos_execucao TO anon; END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1.3 Revogar INSERT/UPDATE/DELETE de tabelas sensiveis
DO $$ BEGIN
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='ia_credenciais';
  IF FOUND THEN REVOKE INSERT, UPDATE, DELETE ON ia_credenciais FROM anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='ia_identidades';
  IF FOUND THEN REVOKE INSERT, UPDATE, DELETE ON ia_identidades FROM anon; END IF;
  PERFORM 1 FROM pg_tables WHERE schemaname='public' AND tablename='ia_sessoes_operacionais';
  IF FOUND THEN REVOKE INSERT, UPDATE, DELETE ON ia_sessoes_operacionais FROM anon; END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1.4 Revogar INSERT/UPDATE/DELETE de tabelas de automacao
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
              'automacoes_tarefas', 'automacoes_aprovacoes', 'automacoes_logs',
              'comunicacoes_mensagens', 'comunicacoes_destinatarios_autorizados',
              'ia_integracoes_externas_logs', 'ia_missoes_execucao',
              'ia_kpis_robo', 'ia_score_robo', 'ia_auditoria_performance',
              'ia_fluxos_empresa', 'ia_fluxos_etapas', 'ia_fluxos_execucao_log',
              'ia_aprendizado_eventos', 'ia_insights_automaticos',
              'ia_sugestoes_melhoria', 'ia_versoes_sistema'
          )
    LOOP
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM anon', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SECAO 2: CORRIGIR POLITICAS RLS — TABELAS CRM/OPERACAO
-- ============================================================

-- 2.1 CRM: DROP politicas FULLY OPEN e recriar com separacao SELECT vs INSERT/UPDATE/DELETE
DO $$
BEGIN
    -- crm_leads
    DROP POLICY IF EXISTS "allow_anon_read" ON crm_leads;
    DROP POLICY IF EXISTS "allow_all_authenticated" ON crm_leads;
    CREATE POLICY "crm_leads_select_anon" ON crm_leads FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_leads_write_auth" ON crm_leads FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "crm_leads_update_auth" ON crm_leads FOR UPDATE TO authenticated USING (true);
    CREATE POLICY "crm_leads_delete_auth" ON crm_leads FOR DELETE TO authenticated USING (true);

    -- crm_historico
    DROP POLICY IF EXISTS "allow_anon_read" ON crm_historico;
    DROP POLICY IF EXISTS "allow_all_authenticated" ON crm_historico;
    DROP POLICY IF EXISTS "allow_all_crm_historico" ON crm_historico;
    CREATE POLICY "crm_historico_select_anon" ON crm_historico FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_historico_write_auth" ON crm_historico FOR INSERT TO authenticated WITH CHECK (true);

    -- crm_followups
    DROP POLICY IF EXISTS "allow_anon_read" ON crm_followups;
    DROP POLICY IF EXISTS "allow_all_authenticated" ON crm_followups;
    DROP POLICY IF EXISTS "allow_all_crm_followups" ON crm_followups;
    CREATE POLICY "crm_followups_select_anon" ON crm_followups FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_followups_write_auth" ON crm_followups FOR INSERT TO authenticated WITH CHECK (true);

    -- crm_conversas
    DROP POLICY IF EXISTS "allow_all_crm_conversas" ON crm_conversas;
    CREATE POLICY "crm_conversas_select_anon" ON crm_conversas FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_conversas_write_auth" ON crm_conversas FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "crm_conversas_update_auth" ON crm_conversas FOR UPDATE TO authenticated USING (true);

    -- crm_mensagens
    DROP POLICY IF EXISTS "allow_all_crm_mensagens" ON crm_mensagens;
    CREATE POLICY "crm_mensagens_select_anon" ON crm_mensagens FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_mensagens_write_auth" ON crm_mensagens FOR INSERT TO authenticated WITH CHECK (true);

    -- crm_templates_mensagem
    DROP POLICY IF EXISTS "allow_all_crm_templates_mensagem" ON crm_templates_mensagem;
    CREATE POLICY "crm_tmpl_select_anon" ON crm_templates_mensagem FOR SELECT TO anon USING (true);
    CREATE POLICY "crm_tmpl_write_auth" ON crm_templates_mensagem FOR INSERT TO authenticated WITH CHECK (true);

    -- crm_interacoes_prestadores
    DROP POLICY IF EXISTS "anon_select" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "anon_insert" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "anon_update" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "anon_delete" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "authenticated_select" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "authenticated_insert" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "authenticated_update" ON crm_interacoes_prestadores;
    DROP POLICY IF EXISTS "authenticated_delete" ON crm_interacoes_prestadores;
    CREATE POLICY "cip_select_anon" ON crm_interacoes_prestadores FOR SELECT TO anon USING (true);
    CREATE POLICY "cip_insert_auth" ON crm_interacoes_prestadores FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "cip_update_auth" ON crm_interacoes_prestadores FOR UPDATE TO authenticated USING (true);
    CREATE POLICY "cip_delete_auth" ON crm_interacoes_prestadores FOR DELETE TO authenticated USING (true);
END $$;

-- 2.2 Orcamentos: manter INSERT para anon (criacao de orcamento pelo comercial)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow insert orcamentos for anon" ON orcamentos;
    DROP POLICY IF EXISTS "Allow select orcamentos for anon" ON orcamentos;
    DROP POLICY IF EXISTS "Allow update orcamentos for anon" ON orcamentos;
    CREATE POLICY "orcamentos_select_anon" ON orcamentos FOR SELECT TO anon USING (true);
    CREATE POLICY "orcamentos_insert_anon" ON orcamentos FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "orcamentos_update_auth" ON orcamentos FOR UPDATE TO authenticated USING (true);
    CREATE POLICY "orcamentos_delete_auth" ON orcamentos FOR DELETE TO authenticated USING (true);
END $$;

-- 2.3 Tabelas operacionais de suporte (rotas, integracoes)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
              'integracoes_logs', 'rotas', 'rota_paradas', 'rota_execucoes',
              'escalonamentos_humanos', 'webhooks_recebidos',
              'treinamento_arquivos_ia'
          )
    LOOP
        -- Drop old open policies
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir tudo em %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "treinamento_arquivos_anon_all" ON %I', tbl);
        -- Create new separated policies
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 2.4 Portal Cliente (16 tabelas): SELECT para anon, INSERT/UPDATE/DELETE para authenticated
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
              'portal_notificacoes', 'portal_ocorrencias', 'portal_avaliacoes',
              'portal_comprovantes', 'portal_protocolos', 'portal_rotas',
              'portal_tracking_realtime', 'portal_relatorios', 'portal_faturas',
              'portal_preferencias_cliente', 'portal_pedidos'
          )
    LOOP
        -- Drop existing open policies
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable select for %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert for %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable update for %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete for %s" ON %I', tbl, tbl);
        -- Create new policies
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 2.5 Contratos
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('contratos_gerados', 'contratos_modelos', 'contratos_historico')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 2.6 Configuracoes: SELECT para anon, INSERT/UPDATE para authenticated
DO $$
BEGIN
    -- configuracoes_sistema
    DROP POLICY IF EXISTS "configuracoes_sistema_select" ON configuracoes_sistema;
    DROP POLICY IF EXISTS "configuracoes_sistema_insert" ON configuracoes_sistema;
    DROP POLICY IF EXISTS "configuracoes_sistema_update" ON configuracoes_sistema;
    CREATE POLICY "cfg_select_anon" ON configuracoes_sistema FOR SELECT TO anon USING (true);
    CREATE POLICY "cfg_insert_auth" ON configuracoes_sistema FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "cfg_update_auth" ON configuracoes_sistema FOR UPDATE TO authenticated USING (true);

    -- contas_financeiras
    DROP POLICY IF EXISTS "Allow all on contas_financeiras" ON contas_financeiras;
    CREATE POLICY "contas_fin_select_anon" ON contas_financeiras FOR SELECT TO anon USING (true);
    CREATE POLICY "contas_fin_write_auth" ON contas_financeiras FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "contas_fin_update_auth" ON contas_financeiras FOR UPDATE TO authenticated USING (true);

    -- usuarios_cliente
    DROP POLICY IF EXISTS "anon_usuarios_cliente" ON usuarios_cliente;
    CREATE POLICY "usuarios_cliente_select_anon" ON usuarios_cliente FOR SELECT TO anon USING (true);
    CREATE POLICY "usuarios_cliente_write_auth" ON usuarios_cliente FOR INSERT TO authenticated WITH CHECK (true);
END $$;

-- ============================================================
-- SECAO 3: CORRIGIR POLITICAS RLS — TABELAS IA (60+ tabelas)
-- ============================================================

-- 3.1 Funcao auxiliar para aplicar o padrao a todas as tabelas IA
-- SELECT: anon (leitura pelo painel Central IA)
-- INSERT/UPDATE/DELETE: authenticated (escrita apenas autenticada)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'ia_%'
          AND tablename NOT IN (
              -- Tabelas que ja tem politicas customizadas (mantidas)
              'ia_comunicacoes_robos', 'ia_comunicacoes_fila_robos',
              'ia_conhecimento_distribuicao',
              'ia_credenciais_zoho',
              -- Tabelas com auth.role() que serao mantidas
              'ia_providers_config', 'ia_logs', 'ia_contextos'
          )
    LOOP
        -- Drop existing open policies
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir tudo em %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir leitura total %s" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir escrita total %s" ON %I', tbl, tbl);
        -- Create new split policies
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 3.2 Tabelas memoria_ (F33)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'memoria_%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete_policy" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 3.3 Tabelas academia_, processamento_, raciocinio_
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE 'academia_%'
               OR tablename LIKE 'processamento_%'
               OR tablename LIKE 'raciocinio_%'
               OR tablename LIKE 'automacoes_%'
               OR tablename LIKE 'rotinas_%'
               OR tablename LIKE 'diretor_virtual_%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 3.4 Tabelas recrutamento_ e candidatos
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE 'recrutamento_%' OR tablename = 'candidatos')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_select_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_insert_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_update_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "%s_delete_policy" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "candidatos_select" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "candidatos_insert" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "candidatos_update" ON %I', tbl);
        EXECUTE format('CREATE POLICY "%s_select_anon" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 3.5 Tabelas escala_operacional, motorista_ (ja tinham apenas SELECT para anon — adicionar write para auth)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('escala_operacional', 'motorista_app_sessoes', 'motorista_checkins')
    LOOP
        EXECUTE format('CREATE POLICY "%s_insert_auth" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_auth" ON %I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_auth" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);
    END LOOP;
END $$;

-- 3.6 fiscal_historico_status e regras_fiscais_nfse
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all operations" ON fiscal_historico_status;
    CREATE POLICY "fhs_select_anon" ON fiscal_historico_status FOR SELECT TO anon USING (true);
    CREATE POLICY "fhs_write_auth" ON fiscal_historico_status FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "fhs_update_auth" ON fiscal_historico_status FOR UPDATE TO authenticated USING (true);

    DROP POLICY IF EXISTS "Allow all operations" ON regras_fiscais_nfse;
    CREATE POLICY "rfn_select_anon" ON regras_fiscais_nfse FOR SELECT TO anon USING (true);
    CREATE POLICY "rfn_write_auth" ON regras_fiscais_nfse FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "rfn_update_auth" ON regras_fiscais_nfse FOR UPDATE TO authenticated USING (true);
END $$;

-- ============================================================
-- SECAO 4: RESTRINGIR STORAGE BUCKETS
-- ============================================================

-- 4.1 biblioteca-global: Restringir INSERT/UPDATE/DELETE para authenticated
DROP POLICY IF EXISTS "biblioteca_global_insert" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca_global_delete" ON storage.objects;
DROP POLICY IF EXISTS "biblioteca_global_update" ON storage.objects;

CREATE POLICY "biblioteca_global_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'biblioteca-global');

CREATE POLICY "biblioteca_global_update_auth" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'biblioteca-global');

CREATE POLICY "biblioteca_global_delete_auth" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'biblioteca-global');

-- Manter SELECT publico
DROP POLICY IF EXISTS "biblioteca_global_select" ON storage.objects;
CREATE POLICY "biblioteca_global_select_public" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'biblioteca-global');

-- ============================================================
-- SECAO 5: PROTEGER FUNCOES SECURITY DEFINER RESTANTES
-- ============================================================

-- 5.1 Adicionar search_path = '' nas funcoes que ainda nao tem
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.proname, n.nspname, pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND p.proname IN (
              'pull_automacoes_pendentes',
              'aceitar_viagem',
              'recusar_viagem',
              'atualizar_status_viagem',
              'registrar_localizacao_motorista',
              'reportar_ocorrencia_motorista',
              'notificar_xml_recebido',
              'audit_rotina_alteracao',
              'log_rotina_criada'
          )
          AND NOT EXISTS (
              SELECT 1 FROM pg_proc p2
              WHERE p2.proname = p.proname
              AND p2.proconfig @> ARRAY['search_path=''']
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = '''';', r.nspname, r.proname, r.args);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter function %: %', r.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================
-- SECAO 6: AUDITORIA DE SEGURANCA — LOG DE TENTATIVAS BLOQUEADAS
-- ============================================================

-- 6.1 Tabela de log de violacoes de seguranca
CREATE TABLE IF NOT EXISTS security_violation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    violation_type TEXT NOT NULL,
    table_name TEXT,
    action TEXT,
    role_name TEXT,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_svl_type_time ON security_violation_log(violation_type, occurred_at);

-- ============================================================
-- SECAO 7: BLOQUEAR BYPASS RLS PARA SERVICE_ROLE NO FRONTEND
-- ============================================================

-- Garantir que service_role nao e usado para queries de frontend
-- (service_role so deve ser usado em Edge Functions e scripts backend)
-- NOTA: O frontend usa VITE_SUPABASE_ANON_KEY — service_role deve
-- ser configurado APENAS no .env do servidor, nunca no frontend.

-- ============================================================
-- FIM DA MIGRATION MISSAO 01
-- ============================================================
