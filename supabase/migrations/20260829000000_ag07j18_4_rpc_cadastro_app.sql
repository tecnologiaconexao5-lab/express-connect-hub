-- =============================================================================
-- AG-07J.18.4 — RPC app_s6_criar_prestador + app_s6_cpf_cnpj_ja_cadastrado
-- Data: 2026-08-29
-- Status: LOCAL ONLY — NÃO executar em produção sem autorização
--
-- Corrige P0: RPC ausente que impede cadastro via App Motorista.
-- O Flutter chama signUp() + app_s6_criar_prestador() sequencialmente.
-- A RPC cria o registro em prestadores com auth_user_id = auth.uid().
--
-- Segurança:
--   - auth.uid() obrigatório (fail-closed)
--   - auth_user_id fixado em auth.uid() (anti-spoof)
--   - liberado_app = false sempre (não liberável via payload)
--   - status = 'em_analise' sempre (não liberável via payload)
--   - SECURITY DEFINER necessário (bypass RLS para INSERT como anon)
--   - search_path fixo (prevenir manipulação de schema)
--   - idempotente: retorna prestador existente se já houver um para o auth_user
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RPC app_s6_cpf_cnpj_ja_cadastrado (dedup check)
--    Chamada ANTES do signUp para verificar se CPF/CNPJ já existe.
--    Retorna true se já existir, false caso contrário.
--    SECURITY DEFINER: necessário para ler prestadores como anon (RLS bloqueia).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_s6_cpf_cnpj_ja_cadastrado(
  p_cpf_cnpj TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_exists BOOLEAN := FALSE;
BEGIN
  IF p_cpf_cnpj IS NULL OR trim(p_cpf_cnpj) = '' THEN
    RETURN FALSE;
  END IF;

  -- Normaliza: remove pontuação, mantém apenas dígitos
  v_normalized := regexp_replace(trim(p_cpf_cnpj), '[^0-9]', '', 'g');

  IF length(v_normalized) < 11 THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM prestadores
    WHERE regexp_replace(coalesce(cpf_cnpj, ''), '[^0-9]', '', 'g') = v_normalized
    LIMIT 1
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

-- Grants: authenticated (App Motorista está autenticado via signUp)
REVOKE ALL ON FUNCTION app_s6_cpf_cnpj_ja_cadastrado(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_s6_cpf_cnpj_ja_cadastrado(TEXT) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. RPC app_s6_criar_prestador (criação de prestador via App)
--    Chamada DEPOIS do signUp (auth user já existe).
--    Cria registro em prestadores com:
--      - auth_user_id = auth.uid() (anti-spoof, sempre o usuário autenticado)
--      - status = 'em_analise' (bloqueado operacionalmente)
--      - liberado_app = false (bloqueado para o App)
--      - origem_cadastro = 'app_motorista' (detectado pelo bridge Kanban)
--    Retorna: { prestador_id: UUID }
--    Idempotente: se já existir prestador para este auth_user, retorna o existente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_s6_criar_prestador(
  p_nome_completo  TEXT,
  p_cpf_cnpj       TEXT DEFAULT NULL,
  p_data_nascimento TEXT DEFAULT NULL,
  p_telefone       TEXT DEFAULT NULL,
  p_email          TEXT DEFAULT NULL,
  p_auth_email     TEXT DEFAULT NULL,  -- mantido para compatibilidade (não utilizado)
  p_senha          TEXT DEFAULT NULL,  -- mantido para compatibilidade (não utilizado)
  p_status         TEXT DEFAULT 'em_analise',
  p_origem         TEXT DEFAULT 'app_prestador',
  p_liberado_app   BOOLEAN DEFAULT FALSE,
  p_metadata       JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID;
  v_existing_id UUID;
  v_new_id UUID;
  v_nome TEXT;
  v_cpf TEXT;
  vTelefone TEXT;
  vEmail TEXT;
  vMeta JSONB;
BEGIN
  -- ========================================================================
  -- SEGURANÇA: auth.uid() obrigatório (fail-closed)
  -- ========================================================================
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- IDEMPOTENCIA: se já existe prestador para este auth_user, retorna
  -- ========================================================================
  SELECT id INTO v_existing_id
  FROM prestadores
  WHERE auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('prestador_id', v_existing_id);
  END IF;

  -- ========================================================================
  -- SEGURANÇA:Overrides de segurança — ignora valores enviados pelo cliente
  -- ========================================================================
  v_nome  := trim(coalesce(p_nome_completo, ''));
  v_cpf   := CASE WHEN trim(coalesce(p_cpf_cnpj, '')) = '' THEN NULL
                  ELSE trim(p_cpf_cnpj) END;
  vTelefone := CASE WHEN trim(coalesce(p_telefone, '')) = '' THEN NULL
                    ELSE trim(p_telefone) END;
  vEmail    := CASE WHEN trim(coalesce(p_email, '')) = '' THEN NULL
                    ELSE trim(p_email) END;
  vMeta     := coalesce(p_metadata, '{}'::jsonb);

  -- Validação: nome é obrigatório
  IF v_nome = '' THEN
    RAISE EXCEPTION 'Nome completo é obrigatório'
      USING ERRCODE = 'P0002';
  END IF;

  -- ========================================================================
  -- INSERT em prestadores
  -- ========================================================================
  INSERT INTO prestadores (
    nome_completo,
    cpf_cnpj,
    data_nascimento,
    telefone,
    email,
    auth_user_id,
    status,
    liberado_app,
    origem,
    origem_cadastro,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_nome,
    v_cpf,
    CASE WHEN p_data_nascimento IS NOT NULL AND trim(p_data_nascimento) != ''
         THEN p_data_nascimento::date
         ELSE NULL END,
    vTelefone,
    vEmail,
    v_auth_uid,           -- anti-spoof: sempre auth.uid()
    'em_analise',         -- fixo: nunca liberado
    false,                -- fixo: nunca liberado
    coalesce(p_origem, 'app_prestador'),
    'app_motorista',      -- detectado pelo bridge enterpriseKanbanService
    vMeta,
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  -- ========================================================================
  -- RETORNO: formato { prestador_id: UUID }
  -- ========================================================================
  RETURN jsonb_build_object('prestador_id', v_new_id);
END;
$$;

-- Grants: authenticated (App Motorista está autenticado via signUp)
REVOKE ALL ON FUNCTION app_s6_criar_prestador(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_s6_criar_prestador(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) TO authenticated;
