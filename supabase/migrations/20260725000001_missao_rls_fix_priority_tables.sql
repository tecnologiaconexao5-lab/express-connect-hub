-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO: CORREÇÃO DE SEGURANÇA E RLS — Priority Tables Go-Live
--
-- Correções baseadas em auditoria real do schema remoto (2026-07-25):
--
--   Colunas disponíveis por tabela:
--     documentos_prestadores:          tenant_id=false, cliente_id=false, prestador_id=true
--     pagamentos_prestadores:          tenant_id=?,    cliente_id=?,    prestador_id=?
--     todas portal_*:                  tenant_id=false, cliente_id=true (algumas têm prestador_id=true)
--     entregas_protocolo:              tenant_id=true,  cliente_id=false, prestador_id=true
--     portal_tracking_realtime:        tenant_id=true,  cliente_id=true,  prestador_id=true
--
--   Padrão: tabelas portal_* usam f_obter_cliente_id_do_usuario() para isolamento
--           tabelas de prestador usam auth.uid() vinculado a prestadores.auth_user_id
--           tabelas compartilhadas (entregas_protocolo, tracking) usam tenant_id
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. documentos_prestadores — Habilita RLS + policies
--    Colunas: prestador_id (UUID) — Sem tenant_id, sem cliente_id
--    ATENÇÃO: prestador_id referencia prestadores.id, NÃO auth.uid().
--             O vínculo é: prestadores.auth_user_id = auth.uid()
--             3 registros (de 27) têm prestador_id=NULL (documentos órfãos
--             carregados por admins do TMS).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.documentos_prestadores ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas (públicas, sem restrição)
DROP POLICY IF EXISTS "Permitir insert documentos prestadores" ON public.documentos_prestadores;
DROP POLICY IF EXISTS "Permitir select documentos prestadores" ON public.documentos_prestadores;
DROP POLICY IF EXISTS "Permitir update documentos prestadores" ON public.documentos_prestadores;

-- Cria policies com verificação de prestador
-- NOTA: prestador_id = prestadores.id (NUNCA é igual a auth.uid())
--       O lookup correto é via prestadores.auth_user_id

-- Prestador vê seus próprios documentos
CREATE POLICY "dp_select_prestador" ON public.documentos_prestadores FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));

-- TMS admin vê documentos de prestadores do seu tenant + documentos órfãos
-- NOTA: sem tenant_id na tabela, o escopo é todo o TMS, mas restrito a
--       usuários autenticados com papel corporativo (vs public+true original)
CREATE POLICY "dp_select_tms" ON public.documentos_prestadores FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND
    (prestador_id IS NULL OR EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id))
  );

-- Prestador insere seus próprios documentos
CREATE POLICY "dp_insert_prestador" ON public.documentos_prestadores FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));

-- TMS admin insere documentos (vínculo opcional)
CREATE POLICY "dp_insert_tms" ON public.documentos_prestadores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
  );

-- Prestador atualiza seus próprios documentos
CREATE POLICY "dp_update_prestador" ON public.documentos_prestadores FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));

-- TMS admin atualiza documentos do seu tenant
CREATE POLICY "dp_update_tms" ON public.documentos_prestadores FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- Prestador deleta seus próprios documentos
CREATE POLICY "dp_delete_prestador" ON public.documentos_prestadores FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));

-- TMS admin deleta documentos do seu tenant
CREATE POLICY "dp_delete_tms" ON public.documentos_prestadores FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. pagamentos_prestadores — Remove política ALL(público) + cria restrita
--    ATENÇÃO: Esta tabela contém valores financeiros sensíveis
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow all pagamentos_prestadores" ON public.pagamentos_prestadores;

DO $$
BEGIN
  -- Tenta criar políticas usando tenant_id se existir
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pagamentos_prestadores' AND column_name='tenant_id') THEN
    CREATE POLICY "pp_select_tenant" ON public.pagamentos_prestadores FOR SELECT
      TO authenticated
      USING (tenant_id = current_tenant_id_safe());

    CREATE POLICY "pp_insert_tenant" ON public.pagamentos_prestadores FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = current_tenant_id_safe());

    CREATE POLICY "pp_update_tenant" ON public.pagamentos_prestadores FOR UPDATE
      TO authenticated
      USING (tenant_id = current_tenant_id_safe());
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pagamentos_prestadores' AND column_name='prestador_id') THEN
    -- NOTA: prestador_id = prestadores.id (NUNCA igual a auth.uid())
    -- O lookup correto é via prestadores.auth_user_id
    CREATE POLICY "pp_select_own" ON public.pagamentos_prestadores FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));

    CREATE POLICY "pp_insert_own" ON public.pagamentos_prestadores FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid())
      );

    CREATE POLICY "pp_update_own" ON public.pagamentos_prestadores FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid()));
  ELSE
    -- Fallback mínimo: apenas authenticated com role check
    CREATE POLICY "pp_select_auth" ON public.pagamentos_prestadores FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. portal_tracking_realtime — Remove policies USING(true) + CREATE restritas
--    Colunas: tenant_id, prestador_id disponíveis
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_tracking_insert" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "ptr_select_auth" ON public.portal_tracking_realtime;
DROP POLICY IF EXISTS "ptr_insert_auth" ON public.portal_tracking_realtime;

-- Mantém: tracking_select_tenant (tenant-based, m114)
-- Mantém: tracking_select_prestador (prestador-based, m114)
-- Mantém: tracking_insert_prestador (prestador+alocacao check, m114)

DO $$
BEGIN
  -- Policy para TMS/admins com tenant
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_tracking_realtime' AND policyname='tracking_select_tenant') THEN
    CREATE POLICY "tracking_select_tenant" ON public.portal_tracking_realtime FOR SELECT
      TO authenticated
      USING ((tenant_id = current_tenant_id_safe()) OR (tenant_id IS NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_tracking_realtime' AND policyname='tracking_select_prestador') THEN
    CREATE POLICY "tracking_select_prestador" ON public.portal_tracking_realtime FOR SELECT
      TO authenticated
      USING (prestador_id = auth.uid() OR prestador_id::text = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_tracking_realtime' AND policyname='tracking_insert_prestador') THEN
    CREATE POLICY "tracking_insert_prestador" ON public.portal_tracking_realtime FOR INSERT
      TO authenticated
      WITH CHECK (
        (prestador_id = auth.uid() OR prestador_id::text = auth.uid()::text) AND
        EXISTS (
          SELECT 1 FROM alocacoes_escala
          WHERE id = alocacao_id
            AND prestador_id::text = auth.uid()::text
            AND status IN ('aceita', 'em_rota', 'ocorrencia')
        )
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. portal_pedidos — Remove policies USING(true) (de portal_cliente_pedidos.sql)
--    Colunas: cliente_id — já existem pp_select_own, pp_insert_own, pp_update_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_pedidos_select" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_insert" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_update" ON public.portal_pedidos;
DROP POLICY IF EXISTS "portal_pedidos_delete" ON public.portal_pedidos;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. portal_ocorrencias — Remove policies USING(true) (de portal_cliente_enterprise.sql)
--    Colunas: cliente_id — já existem po_select_own, po_insert_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_ocorrencias_select" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public.portal_ocorrencias;
DROP POLICY IF EXISTS "portal_ocorrencias_update" ON public.portal_ocorrencias;

-- Adiciona policy para TMS (usuários com tenant_usuarios)
-- portal_ocorrencias não tem tenant_id; faz join via os_id → ordens_servico → tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_ocorrencias' AND policyname='po_select_tms') THEN
    CREATE POLICY "po_select_tms" ON public.portal_ocorrencias
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
        AND (
          cliente_id IS NULL
          OR EXISTS (
            SELECT 1 FROM ordens_servico
            WHERE id = os_id
              AND tenant_id = current_tenant_id_safe()
          )
          OR EXISTS (
            SELECT 1 FROM clientes
            WHERE id = cliente_id
              AND tenant_id = current_tenant_id_safe()
          )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_ocorrencias' AND policyname='po_insert_tms') THEN
    CREATE POLICY "po_insert_tms" ON public.portal_ocorrencias
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_ocorrencias' AND policyname='po_update_tms') THEN
    CREATE POLICY "po_update_tms" ON public.portal_ocorrencias
      FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
        AND (
          EXISTS (
            SELECT 1 FROM ordens_servico
            WHERE id = os_id
              AND tenant_id = current_tenant_id_safe()
          )
          OR EXISTS (
            SELECT 1 FROM clientes
            WHERE id = cliente_id
              AND tenant_id = current_tenant_id_safe()
          )
        )
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. entregas_protocolo — Remove Anon insert + Anon select (públicos)
--    ATENÇÃO: App Motorista usa auth.uid() autenticado, não anon
--    Colunas: tenant_id, prestador_id
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anon insert protocolo" ON public.entregas_protocolo;
DROP POLICY IF EXISTS "Authenticated select all protocolo" ON public.entregas_protocolo;

-- Garante que policies restritas existam
DO $$
BEGIN
  -- TMS usuários do mesmo tenant (ou tenant NULL para dados sem tenant)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='entregas_protocolo_select_authenticated') THEN
    CREATE POLICY "entregas_protocolo_select_authenticated" ON public.entregas_protocolo FOR SELECT
      TO authenticated
      USING ((tenant_id = current_tenant_id_safe()) OR (tenant_id IS NULL));
  END IF;

  -- TMS insere com tenant
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='entregas_protocolo_insert_authenticated') THEN
    CREATE POLICY "entregas_protocolo_insert_authenticated" ON public.entregas_protocolo FOR INSERT
      TO authenticated
      WITH CHECK ((tenant_id = current_tenant_id_safe()) OR (tenant_id IS NULL));
  END IF;

  -- Prestador vê e insere seus protocolos (prestador_id = prestadores.id,
  -- NUNCA igual a auth.uid(); lookup via prestadores.auth_user_id)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='ep_select_prestador') THEN
    CREATE POLICY "ep_select_prestador" ON public.entregas_protocolo FOR SELECT
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='ep_insert_prestador') THEN
    CREATE POLICY "ep_insert_prestador" ON public.entregas_protocolo FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM prestadores p
          JOIN alocacoes_escala ae ON ae.prestador_id = p.id
          WHERE p.auth_user_id = auth.uid()
            AND ae.id = alocacao_id
        )
      );
  END IF;

  -- Portal Cliente vê protocolos de suas entregas (via alocacoes_escala.cliente_id)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='ep_select_portal') THEN
    CREATE POLICY "ep_select_portal" ON public.entregas_protocolo FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM alocacoes_escala ae
          WHERE ae.id = alocacao_id
            AND ae.cliente_id = f_obter_cliente_id_do_usuario()
        )
      );
  END IF;

  -- Mantém a policy de prestador insert own (existente, renomeada)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas_protocolo' AND policyname='Prestador insert own protocolo') THEN
    CREATE POLICY "Prestador insert own protocolo" ON public.entregas_protocolo FOR INSERT
      TO authenticated
      WITH CHECK (
        (prestador_id = auth.uid() OR prestador_id::text = auth.uid()::text) AND
        EXISTS (SELECT 1 FROM alocacoes_escala WHERE id = alocacao_id AND prestador_id::text = auth.uid()::text)
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. portal_avaliacoes — Remove USING(true) policy
--    Colunas: cliente_id — já existe po_select_own, po_insert_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_avaliacoes_select" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public.portal_avaliacoes;
DROP POLICY IF EXISTS "portal_avaliacoes_update" ON public.portal_avaliacoes;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. portal_comprovantes — Remove USING(true) policy
--    Colunas: cliente_id — sem policies _own existentes, criar
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_comprovantes_select" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public.portal_comprovantes;
DROP POLICY IF EXISTS "portal_comprovantes_update" ON public.portal_comprovantes;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_comprovantes' AND policyname='pc_select_own') THEN
    CREATE POLICY "pc_select_own" ON public.portal_comprovantes FOR SELECT
      TO authenticated
      USING (
        cliente_id = f_obter_cliente_id_do_usuario() OR
        (prestador_id IS NOT NULL AND (prestador_id = auth.uid() OR prestador_id::text = auth.uid()::text))
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. portal_rotas — Remove USING(true) policy
--    Colunas: cliente_id — já existe prota_select_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_rotas_select" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_insert" ON public.portal_rotas;
DROP POLICY IF EXISTS "portal_rotas_update" ON public.portal_rotas;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. portal_relatorios — Remove USING(true) policy
--     Colunas: cliente_id — sem policies _own existentes, criar
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_relatorios_select" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_insert" ON public.portal_relatorios;
DROP POLICY IF EXISTS "portal_relatorios_update" ON public.portal_relatorios;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_relatorios' AND policyname='prel_select_own') THEN
    CREATE POLICY "prel_select_own" ON public.portal_relatorios FOR SELECT
      TO authenticated
      USING (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_relatorios' AND policyname='prel_insert_own') THEN
    CREATE POLICY "prel_insert_own" ON public.portal_relatorios FOR INSERT
      TO authenticated
      WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. portal_notificacoes — Remove USING(true) policies
--     Colunas: cliente_id, prestador_id — já existe pn_select_own, pn_update_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public.portal_notificacoes;
DROP POLICY IF EXISTS "notificacoes_select_authenticated" ON public.portal_notificacoes;
-- notificacoes_insert_service é substituída por pn_insert_tms (escopo restrito)
DROP POLICY IF EXISTS "notificacoes_insert_service" ON public.portal_notificacoes;

DO $$
BEGIN
  -- Portal Cliente: insere notificação para si mesmo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_notificacoes' AND policyname='pn_insert_own') THEN
    CREATE POLICY "pn_insert_own" ON public.portal_notificacoes FOR INSERT
      TO authenticated
      WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;

  -- TMS: insere notificação para clientes (mantém funcionalidade de notificacoes_insert_service)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_notificacoes' AND policyname='pn_insert_tms') THEN
    CREATE POLICY "pn_insert_tms" ON public.portal_notificacoes FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. portal_protocolos — Remove USING(true) policy
--     Colunas: cliente_id — já existe pprot_select_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_protocolos_select" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_insert" ON public.portal_protocolos;
DROP POLICY IF EXISTS "portal_protocolos_update" ON public.portal_protocolos;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. portal_preferencias_cliente — Remove USING(true) policy
--     Colunas: cliente_id — sem policies _own existentes, criar
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_preferencias_select" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_insert" ON public.portal_preferencias_cliente;
DROP POLICY IF EXISTS "portal_preferencias_update" ON public.portal_preferencias_cliente;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_preferencias_cliente' AND policyname='ppref_select_own') THEN
    CREATE POLICY "ppref_select_own" ON public.portal_preferencias_cliente FOR SELECT
      TO authenticated
      USING (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_preferencias_cliente' AND policyname='ppref_insert_own') THEN
    CREATE POLICY "ppref_insert_own" ON public.portal_preferencias_cliente FOR INSERT
      TO authenticated
      WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portal_preferencias_cliente' AND policyname='ppref_update_own') THEN
    CREATE POLICY "ppref_update_own" ON public.portal_preferencias_cliente FOR UPDATE
      TO authenticated
      USING (cliente_id = f_obter_cliente_id_do_usuario());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. portal_faturas — Remove USING(true) policy
--     Colunas: cliente_id — já existe pf_select_own
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "portal_faturas_select" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_insert" ON public.portal_faturas;
DROP POLICY IF EXISTS "portal_faturas_update" ON public.portal_faturas;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABELAS NÃO CORRIGIDAS (requerem análise do App Motorista):
--
--   alocacoes_escala:
--     - alocacoes_escala_insert_anon (public, INSERT, check=true) — App Motorista
--     - alocacoes_escala_select_anon (public, SELECT, qual=true) — Tracking público
--     - alocacoes_escala_update_anon (public, UPDATE, qual=true) — App Motorista
--     Motivo: App Motorista usa auth.uid() autenticado, mas as políticas
--     com `public` sugerem que o App pode estar usando anon key em alguns fluxos.
--     Necessário validar qual cliente Supabase o App Motorista utiliza.
--
--   ordens_servico:
--     - os_select_own (anon+authenticated, qual complexa) — Portal Cliente + TMS
--     Motivo: anon role permite consulta pública de OS. Pode ser usado pelo
--     Portal Cliente (que também usa anon key). Remover anon pode quebrar
--     o Portal Cliente. Necessário migrar Portal Cliente para authenticated.
--
--   clientes:
--     - cliente_select_own (public, qual com obter_cliente_id_do_usuario)
--     - cliente_update_own (public, qual com obter_cliente_id_do_usuario)
--     Motivo: Portal Cliente usa estas policies com anon key.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- VALIDAÇÃO FINAL — Reporta policies restantes por tabela
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table text;
  v_policy_count integer;
  v_anon_pub_count integer;
  v_true_count integer;
BEGIN
  RAISE NOTICE '=== VALIDACAO DE POLICIES POS-FIX ===';

  FOR v_table IN SELECT unnest(ARRAY[
    'documentos_prestadores', 'pagamentos_prestadores', 'portal_tracking_realtime',
    'portal_pedidos', 'portal_ocorrencias', 'entregas_protocolo',
    'portal_avaliacoes', 'portal_comprovantes', 'portal_rotas',
    'portal_relatorios', 'portal_notificacoes', 'portal_protocolos',
    'portal_preferencias_cliente', 'portal_faturas'
  ]) LOOP
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies WHERE tablename = v_table;

    SELECT COUNT(*) INTO v_anon_pub_count
    FROM pg_policies
    WHERE tablename = v_table
      AND (roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name]);

    SELECT COUNT(*) INTO v_true_count
    FROM pg_policies
    WHERE tablename = v_table
      AND (qual LIKE '%true%' OR with_check LIKE '%true%');

    RAISE NOTICE 'Tabela: %, Policies: %, Public/Anon: %, USING(true): %',
      v_table, v_policy_count, v_anon_pub_count, v_true_count;
  END LOOP;

  RAISE NOTICE '=== FIM DA VALIDACAO ===';
END $$;
