-- =============================================================================
-- E2E-05E — RPC de resolução de identidade de login LEGADO do APP
-- Data: 2026-09-22 | Projeto: uwrvzsjtpgaifkktpepn
--
-- PROBLEMA: prestadores LEGADOS/HML foram criados com auth.users.email REAL
-- (ex.: teste@conexao.com), mas o APP deriva um e-mail TÉCNICO determinístico
-- do CPF (prestador_<digits>@conexaoexpress.com.br). Para esses registros o
-- login por CPF falha (identificador técnico != e-mail real do auth).
--
-- SOLUÇÃO: RPC SECURITY DEFINER que, dado CPF/CNPJ + senha, devolve o e-mail
-- de autenticação do prestador vinculado (auth_user_id) SOMENTE quando a senha
-- confere. O APP então faz signInWithPassword com esse e-mail.
--
-- MODELO DE SEGURANÇA (checklist E2E-05E):
--   - SECURITY DEFINER; search_path explícito ('public'); objetos qualificados
--     (auth.users, extensions.crypt) → sem manipulação de schema.
--   - PUBLIC revogado; GRANT apenas a anon, authenticated (chamada pré-login).
--   - Retorna no MÁXIMO uma identidade (LIMIT 1).
--   - CPF/CNPJ normalizado (apenas dígitos).
--   - Exige prestadores.auth_user_id NOT NULL.
--   - auth.users acessado SOMENTE por id = prestadores.auth_user_id.
--   - A senha NUNCA é persistida, NUNCA entra em RAISE/log, NUNCA é retornada.
--   - CPF inexistente / sem vínculo / senha errada → resposta INDISTINGUÍVEL (NULL).
--   - Nenhuma listagem/enumeração (sem SELECT que retorne múltiplas linhas).
--   - Qualquer exceção → NULL (não vaza detalhe).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_s6_resolver_identidade_legada(
  p_cpf_cnpj TEXT,
  p_senha    TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits  TEXT;
  v_auth_id UUID;
  v_email   TEXT;
  v_hash    TEXT;
BEGIN
  -- Entradas obrigatórias (fail-closed, sem detalhe).
  IF p_cpf_cnpj IS NULL OR p_senha IS NULL
     OR btrim(p_cpf_cnpj) = '' OR p_senha = '' THEN
    RETURN NULL;
  END IF;

  -- Normaliza CPF/CNPJ (apenas dígitos).
  v_digits := regexp_replace(btrim(p_cpf_cnpj), '[^0-9]', '', 'g');
  IF length(v_digits) < 11 THEN
    RETURN NULL;
  END IF;

  -- Identidade vinculada (no máximo uma).
  SELECT p.auth_user_id
    INTO v_auth_id
  FROM public.prestadores p
  WHERE p.auth_user_id IS NOT NULL
    AND regexp_replace(coalesce(p.cpf_cnpj, ''), '[^0-9]', '', 'g') = v_digits
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- auth.users SOMENTE pelo vínculo objetivo auth_user_id.
  SELECT u.email, u.encrypted_password
    INTO v_email, v_hash
  FROM auth.users u
  WHERE u.id = v_auth_id
  LIMIT 1;

  IF v_email IS NULL OR v_hash IS NULL THEN
    RETURN NULL;
  END IF;

  -- Verifica a senha (bcrypt) SEM persistir/logar. Divergência → NULL.
  IF extensions.crypt(p_senha, v_hash) <> v_hash THEN
    RETURN NULL;
  END IF;

  RETURN v_email;
EXCEPTION
  WHEN OTHERS THEN
    -- Nunca vaza detalhe/exceção (indistinguível).
    RETURN NULL;
END;
$$;

-- Grants mínimos: chamada ocorre ANTES do login (anon) e também autenticada.
REVOKE ALL ON FUNCTION public.app_s6_resolver_identidade_legada(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_s6_resolver_identidade_legada(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.app_s6_resolver_identidade_legada(TEXT, TEXT) IS
  'E2E-05E: resolve o e-mail de auth de prestador LEGADO (CPF+senha). Indistinguível em falha; senha nunca persistida/logada.';
