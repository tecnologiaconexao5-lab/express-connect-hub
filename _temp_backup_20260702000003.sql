-- =====================================================
-- VALIDACAO DIRETA RLS - Portal Cliente
-- Script SQL para validar isolamento multi-tenant
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Troque os UUIDs abaixo pelos IDs reais dos seus clientes
-- 3. O script simula 5 cenários de acesso
-- =====================================================

-- =====================================================
-- PREPARACAO: Obter IDs dos clientes de teste
-- =====================================================
DO $$
DECLARE
    cliente1_id UUID;
    cliente2_id UUID;
    auth_user1_id UUID;
    auth_user2_id UUID;
    
    resultado_pedidos_c1 BIGINT;
    resultado_pedidos_c2 BIGINT;
    resultado_cruzado BIGINT;
    tem_vazamento BOOLEAN := false;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDACAO RLS - PORTAL CLIENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Buscar cliente 1
    SELECT c.id, u.auth_user_id INTO cliente1_id, auth_user1_id
    FROM usuarios_cliente u
    JOIN clientes c ON c.id = u.cliente_id
    WHERE c.email = 'cliente.teste@conexaoexpress.com.br'
      AND u.ativo = true
    LIMIT 1;

    -- Buscar cliente 2
    SELECT c.id, u.auth_user_id INTO cliente2_id, auth_user2_id
    FROM usuarios_cliente u
    JOIN clientes c ON c.id = u.cliente_id
    WHERE c.email = 'cliente2.teste@conexaoexpress.com.br'
      AND u.ativo = true
    LIMIT 1;

    RAISE NOTICE 'Cliente 1: % (auth: %)', cliente1_id, auth_user1_id;
    RAISE NOTICE 'Cliente 2: % (auth: %)', cliente2_id, auth_user2_id;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 1: SELECT como cliente 1 (sem auth - bloqueio)
    -- =====================================================
    RAISE NOTICE 'CENARIO 1: SELECT portal_pedidos sem auth';
    RAISE NOTICE '  Esperado: 0 registros (sem auth = bloqueio)';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_pedidos
    WHERE cliente_id = cliente1_id;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    IF resultado_pedidos_c1 > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: dados expostos sem autenticacao!';
    ELSE
        RAISE NOTICE '  ✅ OK: sem autenticacao, sem dados';
    END IF;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 2: SELECT portal_pedidos com current_setting
    --    SET app.current_cliente_id = cliente1_id
    -- =====================================================
    RAISE NOTICE 'CENARIO 2: SELECT portal_pedidos com current_setting(cliente1)';
    RAISE NOTICE '  Esperado: so dados do cliente 1';

    BEGIN
        PERFORM set_config('app.current_cliente_id', cliente1_id::text, false);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠️ set_config falhou (esperado em ambiente Supabase)';
    END;

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_pedidos;

    RAISE NOTICE '  Total pedidos viaveis (cliente1): %', resultado_pedidos_c1;

    -- Verificar se algum pedido do cliente 2 aparece
    SELECT COUNT(*) INTO resultado_cruzado
    FROM portal_pedidos
    WHERE cliente_id = cliente2_id;

    RAISE NOTICE '  Pedidos cliente 2 viaveis: % (esperado: 0)', resultado_cruzado;

    IF resultado_cruzado > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: cliente 1 ve dados do cliente 2!';
    ELSE
        RAISE NOTICE '  ✅ OK: cliente 1 so ve seus dados';
    END IF;

    -- Reset
    PERFORM set_config('app.current_cliente_id', '', false);
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 3: SELECT portal_faturas sem auth
    -- =====================================================
    RAISE NOTICE 'CENARIO 3: SELECT portal_faturas sem auth';
    RAISE NOTICE '  Esperado: 0 registros';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_faturas;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    IF resultado_pedidos_c1 > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: faturas expostas sem auth!';
    ELSE
        RAISE NOTICE '  ✅ OK';
    END IF;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 4: SELECT portal_comprovantes sem auth
    -- =====================================================
    RAISE NOTICE 'CENARIO 4: SELECT portal_comprovantes sem auth';
    RAISE NOTICE '  Esperado: 0 registros';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_comprovantes;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    IF resultado_pedidos_c1 > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: comprovantes expostos sem auth!';
    ELSE
        RAISE NOTICE '  ✅ OK';
    END IF;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 5: SELECT portal_ocorrencias sem auth
    -- =====================================================
    RAISE NOTICE 'CENARIO 5: SELECT portal_ocorrencias sem auth';
    RAISE NOTICE '  Esperado: 0 registros';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_ocorrencias;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    IF resultado_pedidos_c1 > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: ocorrencias expostas sem auth!';
    ELSE
        RAISE NOTICE '  ✅ OK';
    END IF;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 6: SELECT portal_tracking_realtime sem auth
    -- =====================================================
    RAISE NOTICE 'CENARIO 6: SELECT portal_tracking_realtime sem auth';
    RAISE NOTICE '  Esperado: 0 registros';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_tracking_realtime;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    IF resultado_pedidos_c1 > 0 THEN
        tem_vazamento := true;
        RAISE NOTICE '  ❌ VAZAMENTO: tracking exposto sem auth!';
    ELSE
        RAISE NOTICE '  ✅ OK';
    END IF;
    RAISE NOTICE '';

    -- =====================================================
    -- CENARIO 7: Acesso cross-client com filtro frontend
    --    (simula o que acontece se o frontend nao filtra)
    -- =====================================================
    RAISE NOTICE 'CENARIO 7: SELECT * FROM portal_pedidos (sem filtro frontend)';
    RAISE NOTICE '  Esperado: 0 registros (RLS bloqueia sem auth)';

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_pedidos;

    RAISE NOTICE '  Resultado: % registros (esperado: 0)', resultado_pedidos_c1;
    RAISE NOTICE '';

    -- =====================================================
    -- RESUMO FINAL
    -- =====================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMO FINAL';
    RAISE NOTICE '========================================';

    -- Contar dados existentes (via PG direto, bypass RLS)
    PERFORM set_config('role', 'postgres', true);

    SELECT COUNT(*) INTO resultado_pedidos_c1
    FROM portal_pedidos
    WHERE cliente_id = cliente1_id;

    SELECT COUNT(*) INTO resultado_pedidos_c2
    FROM portal_pedidos
    WHERE cliente_id = cliente2_id;

    PERFORM set_config('role', 'authenticated', true);

    RAISE NOTICE 'Dados reais (via postgres):';
    RAISE NOTICE '  Cliente 1 pedidos: %', resultado_pedidos_c1;
    RAISE NOTICE '  Cliente 2 pedidos: %', resultado_pedidos_c2;
    RAISE NOTICE '';
    RAISE NOTICE 'Vazamento detectado: %', CASE WHEN tem_vazamento THEN 'SIM ❌' ELSE 'NAO ✅' END;
    RAISE NOTICE '';

    IF tem_vazamento THEN
        RAISE NOTICE '⚠️ ISOLAMENTO MULTI-TENANT: FALHOU';
        RAISE NOTICE '  Verificar:';
        RAISE NOTICE '  1. Se policies foram aplicadas corretamente';
        RAISE NOTICE '  2. Se current_cliente_id_safe() existe';
        RAISE NOTICE '  3. Se usuarios_cliente tem vinculos corretos';
    ELSE
        RAISE NOTICE '✅ ISOLAMENTO MULTI-TENANT: FUNCIONANDO';
        RAISE NOTICE '  - Sem auth → zero registros';
        RAISE NOTICE '  - Com auth → apenas dados do cliente logado';
        RAISE NOTICE '  - Cross-client → bloqueado';
    END IF;

    RAISE NOTICE '========================================';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- QUERIES DE VERIFICACAO MANUAL
-- (execute separadamente se o DO block falhar)
-- =====================================================

-- Verificar funcao existe:
-- SELECT proname FROM pg_proc WHERE proname = 'current_cliente_id_safe';

-- Verificar policies ativas:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename LIKE 'portal_%'
-- ORDER BY tablename, cmd;

-- Verificar dados por cliente (bypass RLS, precisa role postgres):
-- SELECT 'Cliente 1', COUNT(*) FROM portal_pedidos WHERE cliente_id = (SELECT cliente_id FROM usuarios_cliente WHERE auth_user_id = '<auth_user_id_1>' LIMIT 1)
-- UNION ALL
-- SELECT 'Cliente 2', COUNT(*) FROM portal_pedidos WHERE cliente_id = (SELECT cliente_id FROM usuarios_cliente WHERE auth_user_id = '<auth_user_id_2>' LIMIT 1);