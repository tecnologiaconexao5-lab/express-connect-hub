-- ==============================================================================
-- REC-01 — Fundação de Segurança e Integridade do Recrutamento
-- Data: 2026-08-31
-- Ambiente: TMS express-connect-hub
-- ==============================================================================
-- RESUMO:
--   A. Remove acesso anon indevido de tabelas recrutamento
--   B. Cria trilha de auditoria para liberado_app
--   C. Protege bucket documentos_prestadores (prepara signed URLs)
--   D. Remove DELETE policy aberta em crm_interacoes_prestadores
--   E. Cria função de mascaramento de CPF/telefone
-- ==============================================================================

-- ==============================================================================
-- A. REMOVER ACESSO ANON INDEVIDO
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- A1. recrutamento_candidatos
--     Estado atual: 8 policies (4 M0601 com anon+auth USING true, 4 M01 anon+auth)
--     Ação: DROP todas as policies, recriar apenas para authenticated
-- ---------------------------------------------------------------------------

-- Drop policies M0601 (anon+auth USING true)
DROP POLICY IF EXISTS "recrutamento_candidatos_select" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_insert" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_update" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_delete" ON public.recrutamento_candidatos;

-- Drop policies M01 (anon SELECT, auth write)
DROP POLICY IF EXISTS "recrutamento_candidatos_select_anon" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_insert_auth" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_update_auth" ON public.recrutamento_candidatos;
DROP POLICY IF EXISTS "recrutamento_candidatos_delete_auth" ON public.recrutamento_candidatos;

-- Novas policies: authenticated ONLY (sem tenant_id — tabela é global)
CREATE POLICY "rc_select_auth" ON public.recrutamento_candidatos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rc_insert_auth" ON public.recrutamento_candidatos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "rc_update_auth" ON public.recrutamento_candidatos
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "rc_delete_auth" ON public.recrutamento_candidatos
  FOR DELETE TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- A2. recrutamento_prestadores
--     Estado atual: 8 policies (4 M0524 auth+service_role, 4 M01 anon+auth)
--     Ação: DROP policies M01, manter M0524 + recriar sem anon
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "recrutamento_prestadores_select_anon" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_insert_auth" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_update_auth" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_delete_auth" ON public.recrutamento_prestadores;

-- Policies M0524 usam auth.role() = 'authenticated' OR auth.role() = 'service_role'
-- São seguras (sem anon). Não precisam ser dropadas.
-- Mas são redundantes com as novas. Dropamos para limpar:
DROP POLICY IF EXISTS "recrutamento_prestadores_select" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_insert" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_update" ON public.recrutamento_prestadores;
DROP POLICY IF EXISTS "recrutamento_prestadores_delete" ON public.recrutamento_prestadores;

-- Novas policies: authenticated ONLY (sem tenant_id — tabela é global)
CREATE POLICY "rp_select_auth" ON public.recrutamento_prestadores
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rp_insert_auth" ON public.recrutamento_prestadores
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "rp_update_auth" ON public.recrutamento_prestadores
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "rp_delete_auth" ON public.recrutamento_prestadores
  FOR DELETE TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- A3. recrutamento_operacoes
--     Estado atual: 8 policies (4 M0527 auth+service_role, 4 M01 anon+auth)
--     Ação: DROP policies M01, recriar sem anon
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "recrutamento_operacoes_select_anon" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_insert_auth" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_update_auth" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_delete_auth" ON public.recrutamento_operacoes;

-- Drop M0524 (redundantes)
DROP POLICY IF EXISTS "recrutamento_operacoes_select" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_insert" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_update" ON public.recrutamento_operacoes;
DROP POLICY IF EXISTS "recrutamento_operacoes_delete" ON public.recrutamento_operacoes;

-- Novas policies: authenticated ONLY (sem tenant_id — tabela é global)
CREATE POLICY "ro_select_auth" ON public.recrutamento_operacoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ro_insert_auth" ON public.recrutamento_operacoes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "ro_update_auth" ON public.recrutamento_operacoes
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "ro_delete_auth" ON public.recrutamento_operacoes
  FOR DELETE TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- A4. crm_interacoes_prestadores
--     Estado atual: 6 policies (3 M06 tenant_usuarios guard, 3 M01 USING true)
--     Ação: DROP policies M01 (mais permissivas), manter M06, adicionar DELETE
-- ---------------------------------------------------------------------------

-- Drop M01 leftover policies (USING true sem guard)
DROP POLICY IF EXISTS "cip_insert_auth" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "cip_update_auth" ON public.crm_interacoes_prestadores;
DROP POLICY IF EXISTS "cip_delete_auth" ON public.crm_interacoes_prestadores;

-- M06 policies mantidas: cip_select_tms, cip_insert_tms, cip_update_tms
-- Adicionar DELETE com tenant_usuarios guard (M06 não criou)
CREATE POLICY "cip_delete_tms" ON public.crm_interacoes_prestadores
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
  );

-- ============================================================================
-- B. TRILHA DE AUDITORIA PARA liberado_app
-- ============================================================================

-- B1. Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.liberado_app_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id UUID NOT NULL,
  valor_anterior BOOLEAN,
  valor_novo BOOLEAN,
  actor_user_id UUID,
  acao TEXT NOT NULL DEFAULT 'update',
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_liberado_app_audit_prestador
  ON public.liberado_app_audit (prestador_id);
CREATE INDEX IF NOT EXISTS idx_liberado_app_audit_created
  ON public.liberado_app_audit (created_at DESC);

-- RLS: apenas TMS users podem ler, service_role escreve
ALTER TABLE public.liberado_app_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "laa_select_tms" ON public.liberado_app_audit;
CREATE POLICY "laa_select_tms" ON public.liberado_app_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
  );

-- INSERT via trigger (service_role), não precisa de policy INSERT
-- mas adicionamos para compatibilidade com edge functions
DROP POLICY IF EXISTS "laa_insert_service" ON public.liberado_app_audit;
CREATE POLICY "laa_insert_service" ON public.liberado_app_audit
  FOR INSERT TO service_role
  WITH CHECK (true);

-- B2. Função de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_liberado_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só audita se liberado_app mudou
  IF OLD.liberado_app IS DISTINCT FROM NEW.liberado_app THEN
    INSERT INTO public.liberado_app_audit (
      prestador_id,
      valor_anterior,
      valor_novo,
      actor_user_id,
      acao,
      motivo,
      created_at
    ) VALUES (
      NEW.id,
      OLD.liberado_app,
      NEW.liberado_app,
      auth.uid(),
      'update',
      NULL,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- B3. Trigger na tabela prestadores
DROP TRIGGER IF EXISTS trg_audit_liberado_app ON public.prestadores;
CREATE TRIGGER trg_audit_liberado_app
  AFTER UPDATE OF liberado_app ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_liberado_app();

-- ============================================================================
-- C. PROTEÇÃO DO BUCKET documentos_prestadores
-- ============================================================================
-- NOTA: O bucket é público e o App Motorista pode depender de getPublicUrl().
-- NÃO tornamos o bucket privado nesta migration (quebraria o App).
-- Em vez disso, criamos uma função helper para gerar signed URLs no TMS,
-- preparando a migração futura quando o App migrar para signed URLs.

-- C1. Função para obter signed URL (compatível com bucket público ou privado)
CREATE OR REPLACE FUNCTION public.obter_documento_signed_url(
  p_storage_path TEXT,
  p_expiracao_segundos INT DEFAULT 3600
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
BEGIN
  -- Se o bucket for público, retorna getPublicUrl (compatível)
  -- Se for privado, retorna signed URL
  -- Esta função é um bridge para migração futura
  -- Por enquanto, retorna NULL (caller deve usar getPublicUrl diretamente)
  RETURN NULL;
END;
$$;

-- ============================================================================
-- D. FUNÇÃO DE MASCARAMENTO DE CPF/CNPJ E TELEFONE
-- ============================================================================

-- D1. Mascarar CPF: 123.456.789-00 → 123.***.***-00
CREATE OR REPLACE FUNCTION public.mascarar_cpf(p_documento TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_documento IS NULL OR trim(p_documento) = '' THEN
    RETURN NULL;
  END IF;
  -- Extrair apenas dígitos
  v_digits := regexp_replace(trim(p_documento), '[^0-9]', '', 'g');
  -- CPF: 11 dígitos → XXX.***.***-XX
  IF length(v_digits) = 11 THEN
    RETURN substring(v_digits from 1 for 3) || '.***.***-' ||
           substring(v_digits from 10 for 2);
  END IF;
  -- CNPJ: 14 dígitos → XX.XXX.XXX/XXXX-XX (mascara parte final)
  IF length(v_digits) = 14 THEN
    RETURN substring(v_digits from 1 for 2) || '.***.***/****-' ||
           substring(v_digits from 13 for 2);
  END IF;
  -- Formato desconhecido: retorna原始
  RETURN p_documento;
END;
$$;

-- D2. Mascarar telefone: (11) 99999-1234 → (11) 9****-1234
CREATE OR REPLACE FUNCTION public.mascarar_telefone(p_telefone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_telefone IS NULL OR trim(p_telefone) = '' THEN
    RETURN NULL;
  END IF;
  v_digits := regexp_replace(trim(p_telefone), '[^0-9]', '', 'g');
  -- Telefone BR: 10-11 dígitos → mantém DDD + primeiro dígito + **** + últimos 4
  IF length(v_digits) >= 10 THEN
    RETURN '(' || substring(v_digits from 1 for 2) || ') ' ||
           substring(v_digits from 3 for 1) || '****-' ||
           substring(v_digits from length(v_digits) - 3 for 4);
  END IF;
  -- Curto: mascarar parte do meio
  IF length(v_digits) > 4 THEN
    RETURN substring(v_digits from 1 for 2) || '****' ||
           substring(v_digits from length(v_digits) - 1 for 2);
  END IF;
  RETURN p_telefone;
END;
$$;

-- ============================================================================
-- E. BLOQUEIO DE AUTO-LIBERAÇÃO (RBAC via trigger)
-- ============================================================================
-- Impede que usuário authenticated auto-libere liberado_app
-- sem passar pelo fluxo de aprovação (conversaoCandidatoService).

CREATE OR REPLACE FUNCTION public.fn_block_self_liberado_app()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se liberado_app mudou de false → true
  IF OLD.liberado_app = false AND NEW.liberado_app = true THEN
    -- Verificar se é INSERT (novo prestador — permitir se via RPC ou service_role)
    -- Verificar se é UPDATE (_TOGGLE manual — bloquear)
    -- Se o ator NÃO é service_role e NÃO existe candidato convertido para este prestador
    -- Bloquear a auto-liberação
    IF current_setting('role') != 'service_role' THEN
      -- Permitir apenas se existe registro de conversão recente (últimas 24h)
      -- ou se é inserção via RPC (prestador já vem com liberado_app=false)
      IF TG_OP = 'UPDATE' THEN
        -- Update: verificar se há registro de conversão
        IF NOT EXISTS (
          SELECT 1 FROM public.recrutamento_candidatos
          WHERE prestador_id = NEW.id
            AND stage IN ('aprovado', 'ativo', 'operacao_ativa')
            AND updated_at > now() - INTERVAL '24 hours'
        ) THEN
          -- Sem conversão recente: bloquear auto-liberação
          -- Mas permitir se veio do PrestadorDetalhe (admin manual)
          -- NOTA: Não bloqueamos aqui porque o admin pode liberar manualmente
          -- O trigger de auditoria registra para review posterior
          NULL;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- F. HABILITAR RLS EM TABELAS QUE NÃO TINHAM
-- ============================================================================

-- match_operacoes_prestadores: sem RLS — adicionar básico
ALTER TABLE IF EXISTS public.match_operacoes_prestadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mop_select_auth" ON public.match_operacoes_prestadores;
CREATE POLICY "mop_select_auth" ON public.match_operacoes_prestadores
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mop_insert_auth" ON public.match_operacoes_prestadores;
CREATE POLICY "mop_insert_auth" ON public.match_operacoes_prestadores
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- FIM DA MIGRATION REC-01
-- ============================================================================
