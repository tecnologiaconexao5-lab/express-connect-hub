-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSÃO 129-C.2-TMS — DERIVAR PRESTADOR, TENANT E CREATED_BY
-- NO BACKEND DO REEMBOLSO (P0)
--
-- OBJETIVO:
--   Derivar automaticamente prestador, tenant_id e created_by no INSERT
--   feito pelo App Motorista autenticado (Flutter PWA).
--
-- CAUSA RAIZ:
--   App envia payload sem prestador (correto por segurança),
--   mas a coluna prestador é NOT NULL e não havia trigger
--   para derivar automaticamente → violação NOT NULL.
--
-- SOLUÇÃO:
--   BEFORE INSERT trigger que deriva:
--     - prestador  ← prestadores.nome_completo via auth.uid()
--     - tenant_id  ← current_tenant_id_safe()
--     - created_by ← auth.uid()
--     - status     ← 'pendente' (forçado)
--
-- VALIDAÇÕES:
--   - Usuário autenticado (auth.uid() != null)
--   - Usuário com prestador vinculado (prestadores.auth_user_id)
--   - OS existe
--   - OS pertence ao prestador (via alocacoes_escala.prestador_id)
--   - OS do mesmo tenant
--   - valor > 0
--   - tipo válido (pedagio, ajudante, estadia, diaria, outros)
--   - descrição não vazia
--   - status forçado como pendente
--
-- SEGURANÇA:
--   - Trigger SECURITY DEFINER (owner privileges)
--   - RLS mantida com tenant isolation
--   - App não precisa/precisa enviar prestador, tenant_id, created_by
-- ═══════════════════════════════════════════════════════════════════════════════

-- =============================================================================
-- SEÇÃO 1: FUNÇÃO AUXILIAR — obter prestador do auth.uid()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.f_obter_prestador_por_auth()
RETURNS TABLE (
    nome_completo TEXT,
    prestador_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.nome_completo, p.id
    FROM public.prestadores p
    WHERE p.auth_user_id = auth.uid()
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.f_obter_prestador_por_auth() IS
    'M129-C.2 — Retorna nome_completo, id e tenant_id do prestador vinculado ao auth.uid() atual.';

-- =============================================================================
-- SEÇÃO 2: TRIGGER FUNCTION — derivar e validar no INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_f_derivar_reembolso_prestador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prestador_nome TEXT;
    v_prestador_id UUID;
    v_tenant_id UUID;
BEGIN
    -- 1. Validar autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'M129-C.2: Usuário não autenticado';
    END IF;

    -- 2. Buscar prestador vinculado ao auth.uid()
    SELECT p.nome_completo, p.id
    INTO STRICT v_prestador_nome, v_prestador_id
    FROM public.prestadores p
    WHERE p.auth_user_id = auth.uid();

    -- 3. Derivar tenant_id
    v_tenant_id := public.current_tenant_id_safe();

    -- 4. Forçar prestador (ignorar qualquer valor enviado pelo App)
    NEW.prestador := v_prestador_nome;

    -- 5. Forçar tenant_id
    NEW.tenant_id := v_tenant_id;

    -- 6. Forçar created_by
    NEW.created_by := auth.uid();

    -- 7. Forçar status = pendente
    IF NEW.status IS DISTINCT FROM 'pendente' THEN
        RAISE EXCEPTION 'M129-C.2: Status do reembolso deve ser pendente';
    END IF;
    NEW.status := 'pendente';

    -- 8. Validar tipo
    IF NEW.tipo IS NULL OR NEW.tipo NOT IN ('pedagio', 'ajudante', 'estadia', 'diaria', 'outros') THEN
        RAISE EXCEPTION 'M129-C.2: Tipo inválido. Valores permitidos: pedagio, ajudante, estadia, diaria, outros';
    END IF;

    -- 9. Validar valor > 0
    IF NEW.valor IS NULL OR NEW.valor <= 0 THEN
        RAISE EXCEPTION 'M129-C.2: Valor deve ser maior que zero';
    END IF;

    -- 10. Validar descrição
    IF NEW.descricao IS NULL OR length(trim(NEW.descricao)) = 0 THEN
        RAISE EXCEPTION 'M129-C.2: Descrição não pode estar vazia';
    END IF;

    -- 11. Validar OS (se fornecida)
    IF NEW.os_id IS NOT NULL THEN
        -- 11a. OS existe?
        IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE id = NEW.os_id) THEN
            RAISE EXCEPTION 'M129-C.2: OS inexistente';
        END IF;

        -- 11b. OS pertence ao prestador? (via alocacoes_escala.prestador_id)
        IF NOT EXISTS (
            SELECT 1
            FROM public.alocacoes_escala
            WHERE ordem_servico_id = NEW.os_id
              AND prestador_id = v_prestador_id
        ) THEN
            RAISE EXCEPTION 'M129-C.2: OS não pertence a este prestador';
        END IF;

        -- 11c. OS do mesmo tenant?
        IF NOT EXISTS (
            SELECT 1
            FROM public.ordens_servico
            WHERE id = NEW.os_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'M129-C.2: OS de outro tenant';
        END IF;
    END IF;

    -- 12. Garantir timestamps
    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;
    NEW.updated_at := now();

    RETURN NEW;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'M129-C.2: Usuário sem prestador vinculado';
END;
$$;

COMMENT ON FUNCTION public.trg_f_derivar_reembolso_prestador() IS
    'M129-C.2 — BEFORE INSERT trigger: deriva prestador, tenant_id, created_by; força status pendente; valida OS, tipo, valor, descrição.';

-- =============================================================================
-- SEÇÃO 3: TRIGGER NA TABELA
-- =============================================================================

DROP TRIGGER IF EXISTS trg_rp_derivar_prestador ON public.reembolsos_prestador;
CREATE TRIGGER trg_rp_derivar_prestador
    BEFORE INSERT ON public.reembolsos_prestador
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_f_derivar_reembolso_prestador();

-- =============================================================================
-- SEÇÃO 4: ATUALIZAÇÃO DE RLS
-- Mantém o padrão Missão 16/18: tenant isolation.
-- A trigger garante que prestador/tenant/created_by estão corretos.
-- O WITH CHECK no INSERT valida que tenant_id = current_tenant_id_safe().
-- =============================================================================

-- Garantir que anon NÃO tem acesso (sem SELECT, INSERT, UPDATE, DELETE)
REVOKE ALL ON TABLE public.reembolsos_prestador FROM anon;
REVOKE ALL ON TABLE public.reembolsos_prestador FROM public;

-- Grants específicos para cada role
GRANT SELECT ON TABLE public.reembolsos_prestador TO authenticated;
GRANT INSERT ON TABLE public.reembolsos_prestador TO authenticated;
GRANT UPDATE ON TABLE public.reembolsos_prestador TO authenticated;
GRANT DELETE ON TABLE public.reembolsos_prestador TO authenticated;

GRANT ALL ON TABLE public.reembolsos_prestador TO service_role;

-- NOTA: A policy rp_insert_tenant já existe e usa:
--   WITH CHECK (tenant_id = current_tenant_id_safe())
-- Após a trigger definir NEW.tenant_id corretamente, o WITH CHECK passa.
-- Não há necessidade de alterar a policy.

-- =============================================================================
-- SEÇÃO 5: NOTIFICAR SCHEMA CACHE
-- Força o PostgREST a recarregar o schema para reconhecer a trigger
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
