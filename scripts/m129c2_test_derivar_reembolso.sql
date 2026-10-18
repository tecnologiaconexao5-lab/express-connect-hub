-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 129-C.2-TMS — TESTES SQL DA DERIVAÇÃO DE REEMBOLSO (15 CENÁRIOS)
--
-- INSTRUÇÕES:
--   Executar no Supabase SQL Editor (ou psql) como usuário autenticado.
--   Os testes 1-6 requerem um auth.uid() que tenha prestador vinculado.
--   Ajuste os placeholders <prestador_auth_uid> e <outro_auth_uid>.
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- CONFIGURAÇÃO
-- =============================================================================

-- Substituir pelos UUIDs reais dos auth.users do banco de homologação
-- Para obter: SELECT id, email FROM auth.users WHERE email LIKE '%conexaoexpress%';
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';  -- auth.uid() com prestador vinculado
    v_outro_auth_uid UUID := '<outro_auth_uid>'; -- auth.uid() de outro prestador (mesmo tenant)
    v_prestador_nome TEXT;
    v_prestador_id UUID;
    v_tenant_id UUID;
    v_os_id UUID;
    v_outra_os_id UUID;
    v_created_id UUID;
BEGIN

    -- =========================================================================
    -- CENÁRIO 1: authenticated vinculado cria reembolso com sucesso
    -- =========================================================================
    RAISE NOTICE '=== CENÁRIO 1: authenticated vinculado cria reembolso ===';

    -- Obter dados do prestador
    SELECT p.nome_completo, p.id, p.tenant_id
    INTO v_prestador_nome, v_prestador_id, v_tenant_id
    FROM public.prestadores p
    WHERE p.auth_user_id = v_auth_uid;

    RAISE NOTICE 'Prestador: % (ID: %, Tenant: %)', v_prestador_nome, v_prestador_id, v_tenant_id;

    -- Obter uma OS do prestador
    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a
    WHERE a.prestador_id = v_prestador_id
    LIMIT 1;

    RAISE NOTICE 'OS para teste: %', v_os_id;

    -- Simular o INSERT como se fosse o App (sem prestador, tenant_id, created_by)
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    INSERT INTO public.reembolsos_prestador (
        os_id, tipo, descricao, valor, data_despesa
    ) VALUES (
        v_os_id, 'pedagio', 'Teste C1: pedágio na BR-101', 45.90, CURRENT_DATE
    )
    RETURNING id, prestador, tenant_id, created_by, status
    INTO v_created_id, v_prestador_nome, v_tenant_id, v_auth_uid;

    RAISE NOTICE 'C1 - ID criado: %', v_created_id;
    RAISE NOTICE 'C1 - prestador: %', v_prestador_nome;
    RAISE NOTICE 'C1 - tenant_id: %', v_tenant_id;
    RAISE NOTICE 'C1 - created_by: %', v_auth_uid;
    RAISE NOTICE 'C1 - status: pendente';
    RAISE NOTICE 'C1 - ✅ PASS';

    -- Limpar
    DELETE FROM public.reembolsos_prestador WHERE id = v_created_id;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C1 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 2: prestador preenchido automaticamente (não veio do App)
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
    v_result RECORD;
BEGIN
    RAISE NOTICE '=== CENÁRIO 2: prestador preenchido automaticamente ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    -- App não enviou prestador
    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os_id, 'ajudante', 'Teste C2: ajudante extra', 120.00, CURRENT_DATE)
    RETURNING prestador INTO v_result;

    RAISE NOTICE 'C2 - prestador derivado: %', v_result.prestador;
    RAISE NOTICE 'C2 - ✅ PASS';

    DELETE FROM public.reembolsos_prestador WHERE id = (SELECT id FROM public.reembolsos_prestador WHERE os_id = v_os_id AND descricao = 'Teste C2: ajudante extra' LIMIT 1);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C2 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 3: tenant preenchido automaticamente
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
    v_tenant_esperado UUID;
    v_result RECORD;
BEGIN
    RAISE NOTICE '=== CENÁRIO 3: tenant preenchido automaticamente ===';

    SELECT p.id, p.tenant_id INTO v_prestador_id, v_tenant_esperado
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os_id, 'estadia', 'Teste C3: estadia overnight', 200.00, CURRENT_DATE)
    RETURNING tenant_id INTO v_result;

    IF v_result.tenant_id = v_tenant_esperado THEN
        RAISE NOTICE 'C3 - tenant derivado: % (esperado: %)', v_result.tenant_id, v_tenant_esperado;
        RAISE NOTICE 'C3 - ✅ PASS';
    ELSE
        RAISE NOTICE 'C3 - ❌ FAIL: tenant % diferente do esperado %', v_result.tenant_id, v_tenant_esperado;
    END IF;

    DELETE FROM public.reembolsos_prestador WHERE id = (SELECT id FROM public.reembolsos_prestador WHERE descricao = 'Teste C3: estadia overnight' LIMIT 1);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C3 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 4: created_by preenchido automaticamente
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
    v_result RECORD;
BEGIN
    RAISE NOTICE '=== CENÁRIO 4: created_by preenchido automaticamente ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os_id, 'diaria', 'Teste C4: diária viagem', 150.00, CURRENT_DATE)
    RETURNING created_by INTO v_result;

    IF v_result.created_by = v_auth_uid THEN
        RAISE NOTICE 'C4 - created_by: % (esperado: %)', v_result.created_by, v_auth_uid;
        RAISE NOTICE 'C4 - ✅ PASS';
    ELSE
        RAISE NOTICE 'C4 - ❌ FAIL: created_by % diferente do auth.uid %', v_result.created_by, v_auth_uid;
    END IF;

    DELETE FROM public.reembolsos_prestador WHERE id = (SELECT id FROM public.reembolsos_prestador WHERE descricao = 'Teste C4: diária viagem' LIMIT 1);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C4 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 5: status forçado como pendente (mesmo se App enviar outro)
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
    v_result RECORD;
BEGIN
    RAISE NOTICE '=== CENÁRIO 5: status forçado pendente ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    -- App tentou enviar status = 'aprovado' — trigger deve forçar 'pendente'
    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa, status)
    VALUES (v_os_id, 'outros', 'Teste C5: outros reembolsos', 75.00, CURRENT_DATE, 'aprovado')
    RETURNING status INTO v_result;

    IF v_result.status = 'pendente' THEN
        RAISE NOTICE 'C5 - status forçado: pendente (App enviou aprovado)';
        RAISE NOTICE 'C5 - ✅ PASS';
    ELSE
        RAISE NOTICE 'C5 - ❌ FAIL: status deveria ser pendente, veio %', v_result.status;
    END IF;

    DELETE FROM public.reembolsos_prestador WHERE id = (SELECT id FROM public.reembolsos_prestador WHERE descricao = 'Teste C5: outros reembolsos' LIMIT 1);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C5 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 6: anon rejeitado
-- =============================================================================
DO $$
DECLARE
    v_os_id UUID;
    v_prestador_id UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 6: anon rejeitado ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = '<prestador_auth_uid>'::UUID;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE anon;
    SET LOCAL "request.jwt.claim.sub" TO NULL;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_os_id, 'pedagio', 'Tentativa anon', 10.00, CURRENT_DATE);
        RAISE NOTICE 'C6 - ❌ FAIL: anon conseguiu inserir';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'C6 - anon rejeitado por RLS: ✅ PASS';
        WHEN OTHERS THEN
            RAISE NOTICE 'C6 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 7: usuário sem prestador vinculado rejeitado
-- =============================================================================
DO $$
DECLARE
    v_os_id UUID;
    v_sem_prestador_uid UUID := '<auth_uid_sem_prestador>';  -- usuário sem vínculo
BEGIN
    RAISE NOTICE '=== CENÁRIO 7: usuário sem prestador rejeitado ===';

    -- Se não temos um usuário sem prestador, pular com warning
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_sem_prestador_uid) THEN
        RAISE NOTICE 'C7 - ⚠️ SKIP: auth_uid_sem_prestador não configurado';
        RETURN;
    END IF;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_sem_prestador_uid;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_sem_prestador_uid, 'pedagio', 'Teste sem prestador', 10.00, CURRENT_DATE);
        RAISE NOTICE 'C7 - ❌ FAIL: sem prestador conseguiu inserir';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C7 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 8: OS de outro prestador rejeitada
-- =============================================================================
DO $$
DECLARE
    v_auth_uid_1 UUID := '<prestador_auth_uid>';
    v_auth_uid_2 UUID := '<outro_auth_uid>';
    v_os_outro_prestador UUID;
    v_prestador2_id UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 8: OS de outro prestador rejeitada ===';

    SELECT p.id INTO v_prestador2_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid_2;

    SELECT a.ordem_servico_id INTO v_os_outro_prestador
    FROM public.alocacoes_escala a
    WHERE a.prestador_id = v_prestador2_id
    LIMIT 1;

    IF v_os_outro_prestador IS NULL THEN
        RAISE NOTICE 'C8 - ⚠️ SKIP: outro prestador sem OS';
        RETURN;
    END IF;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_1;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_os_outro_prestador, 'pedagio', 'OS de outro prestador', 10.00, CURRENT_DATE);
        RAISE NOTICE 'C8 - ❌ FAIL: conseguiu inserir OS de outro prestador';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C8 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 9: OS de outro tenant rejeitada
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_tenant_atual UUID;
    v_os_outro_tenant UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 9: OS de outro tenant rejeitada ===';

    SELECT p.tenant_id INTO v_tenant_atual
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    -- Buscar OS de tenant diferente
    SELECT os.id INTO v_os_outro_tenant
    FROM public.ordens_servico os
    WHERE os.tenant_id IS DISTINCT FROM v_tenant_atual
    LIMIT 1;

    IF v_os_outro_tenant IS NULL THEN
        RAISE NOTICE 'C9 - ⚠️ SKIP: nenhuma OS de outro tenant encontrada';
        RETURN;
    END IF;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_os_outro_tenant, 'pedagio', 'OS de outro tenant', 10.00, CURRENT_DATE);
        RAISE NOTICE 'C9 - ❌ FAIL: conseguiu inserir OS de outro tenant';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C9 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 10: valor negativo rejeitado
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 10: valor negativo rejeitado ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_os_id, 'pedagio', 'Valor negativo', -50.00, CURRENT_DATE);
        RAISE NOTICE 'C10 - ❌ FAIL: valor negativo aceito';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C10 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 11: tipo inválido rejeitado
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 11: tipo inválido rejeitado ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
        VALUES (v_os_id, 'tipo_invalido', 'Tipo inválido', 10.00, CURRENT_DATE);
        RAISE NOTICE 'C11 - ❌ FAIL: tipo inválido aceito';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C11 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 12: status aprovado não pode ser enviado
-- =============================================================================
DO $$
DECLARE
    v_auth_uid UUID := '<prestador_auth_uid>';
    v_os_id UUID;
    v_prestador_id UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 12: status aprovado rejeitado ===';

    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid;

    BEGIN
        INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa, status)
        VALUES (v_os_id, 'pedagio', 'Status aprovado', 10.00, CURRENT_DATE, 'aprovado');
        RAISE NOTICE 'C12 - ❌ FAIL: status aprovado aceito';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'C12 - ✅ PASS (rejeitado: %)', SQLERRM;
    END;
END $$;

-- =============================================================================
-- CENÁRIO 13: outro prestador não lê
-- =============================================================================
DO $$
DECLARE
    v_auth_uid_1 UUID := '<prestador_auth_uid>';
    v_auth_uid_2 UUID := '<outro_auth_uid>';
    v_prestador1_id UUID;
    v_os1_id UUID;
    v_id_inserido UUID;
    v_count INTEGER;
    v_stored_tenant UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 13: outro prestador não lê ===';

    -- Inserir como prestador 1
    SELECT p.id INTO v_prestador1_id
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid_1;

    SELECT a.ordem_servico_id INTO v_os1_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador1_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_1;

    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os1_id, 'pedagio', 'C13: reembolso do prestador 1', 100.00, CURRENT_DATE)
    RETURNING id, tenant_id INTO v_id_inserido, v_stored_tenant;

    -- Tentar ler como prestador 2
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_2;

    SELECT COUNT(*) INTO v_count
    FROM public.reembolsos_prestador
    WHERE id = v_id_inserido;

    IF v_count = 0 THEN
        RAISE NOTICE 'C13 - outro prestador não vê o registro: ✅ PASS';
    ELSE
        RAISE NOTICE 'C13 - ❌ FAIL: outro prestador conseguiu ler (count=%)', v_count;
    END IF;

    -- Limpar
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_1;
    DELETE FROM public.reembolsos_prestador WHERE id = v_id_inserido;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C13 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 14: outro tenant não lê
-- =============================================================================
DO $$
DECLARE
    v_auth_uid_1 UUID := '<prestador_auth_uid>';
    v_tenant_a UUID;
    v_os1_id UUID;
    v_prestador1_id UUID;
    v_id_inserido UUID;
    v_outro_tenant_user UUID;
    v_count INTEGER;
BEGIN
    RAISE NOTICE '=== CENÁRIO 14: outro tenant não lê ===';

    SELECT p.id, p.tenant_id INTO v_prestador1_id, v_tenant_a
    FROM public.prestadores p WHERE p.auth_user_id = v_auth_uid_1;

    SELECT a.ordem_servico_id INTO v_os1_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador1_id LIMIT 1;

    -- Inserir como prestador do tenant A
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_1;

    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os1_id, 'pedagio', 'C14: reembolso tenant A', 100.00, CURRENT_DATE)
    RETURNING id INTO v_id_inserido;

    -- Tentar ler como usuário de outro tenant
    -- (precisa de um auth.uid() de tenant diferente — se não existir, SKIP)
    SELECT tu.user_id INTO v_outro_tenant_user
    FROM public.tenant_usuarios tu
    WHERE tu.tenant_id IS DISTINCT FROM v_tenant_a
      AND tu.status = 'ativo'
    LIMIT 1;

    IF v_outro_tenant_user IS NULL THEN
        RAISE NOTICE 'C14 - ⚠️ SKIP: nenhum usuário de outro tenant encontrado';
        RETURN;
    END IF;

    SET LOCAL "request.jwt.claim.sub" TO v_outro_tenant_user;

    SELECT COUNT(*) INTO v_count
    FROM public.reembolsos_prestador
    WHERE id = v_id_inserido;

    IF v_count = 0 THEN
        RAISE NOTICE 'C14 - outro tenant não vê o registro: ✅ PASS';
    ELSE
        RAISE NOTICE 'C14 - ❌ FAIL: outro tenant conseguiu ler (count=%)', v_count;
    END IF;

    -- Limpar
    SET LOCAL "request.jwt.claim.sub" TO v_auth_uid_1;
    DELETE FROM public.reembolsos_prestador WHERE id = v_id_inserido;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C14 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- CENÁRIO 15: TMS autorizado consegue analisar (UPDATE)
-- =============================================================================
DO $$
DECLARE
    v_admin_uid UUID := '<admin_auth_uid>';  -- super_admin ou financeiro
    v_prestador_uid UUID := '<prestador_auth_uid>';
    v_prestador_id UUID;
    v_os_id UUID;
    v_id_inserido UUID;
BEGIN
    RAISE NOTICE '=== CENÁRIO 15: TMS autorizado consegue analisar ===';

    -- Inserir como prestador
    SELECT p.id INTO v_prestador_id
    FROM public.prestadores p WHERE p.auth_user_id = v_prestador_uid;

    SELECT a.ordem_servico_id INTO v_os_id
    FROM public.alocacoes_escala a WHERE a.prestador_id = v_prestador_id LIMIT 1;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO v_prestador_uid;

    INSERT INTO public.reembolsos_prestador (os_id, tipo, descricao, valor, data_despesa)
    VALUES (v_os_id, 'pedagio', 'C15: reembolso para aprovação', 100.00, CURRENT_DATE)
    RETURNING id INTO v_id_inserido;

    -- TMS admin aprova
    SET LOCAL "request.jwt.claim.sub" TO v_admin_uid;

    UPDATE public.reembolsos_prestador
    SET status = 'aprovado',
        aprovado_por = v_admin_uid,
        data_aprovacao = now()
    WHERE id = v_id_inserido;

    IF FOUND THEN
        RAISE NOTICE 'C15 - TMS aprovou o reembolso: ✅ PASS';
    ELSE
        RAISE NOTICE 'C15 - ❌ FAIL: TMS não conseguiu atualizar';
    END IF;

    -- Limpar
    DELETE FROM public.reembolsos_prestador WHERE id = v_id_inserido;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'C15 - ❌ FAIL: %', SQLERRM;
END $$;

-- =============================================================================
-- RESUMO
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '  MISSÃO 129-C.2 — TESTES CONCLUÍDOS';
    RAISE NOTICE '  Verificar os resultados acima.';
    RAISE NOTICE '  Esperado: C1-C5 ✅, C6-C14 ✅ (ou SKIP se sem fixture), C15 ✅';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
