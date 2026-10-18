-- ADM-APP-02C.2 - SEGURANCA RECONCILIADA (migration NOVA incremental)
-- Base: ADM-APP-02C.1 = PASS. Fecha A-8, A-9 e A-12.
-- NAO e a REC-01/REC-02 (obsoletas para aplicacao direta).
--
-- [1] Guarda BEFORE UPDATE em prestadores  -> bloqueia self-liberation (A-9)
-- [2] Auditoria append-only                -> liberado_app_audit (A-12)
-- [3] SELECT do prestador limitado ao proprio (A-8)
-- [4] RLS de recrutamento restrito a TMS   -> 4 tabelas
-- [5] candidatos: revoga anon              -> fecha buraco
--
-- NAO faz: storage/bucket (02D), pre-cadastro (02B), tenant_id, reservas_banco,
--          match_operacoes_prestadores, obter_documento_signed_url, RPCs app_s6.
-- Idempotente: IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.
BEGIN;

-- [1] TABELA DE AUDITORIA APPEND-ONLY (reconciliada)
CREATE TABLE IF NOT EXISTS public.liberado_app_audit (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id   uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  campo          text NOT NULL,
  valor_anterior text,
  valor_novo     text,
  actor_user_id  uuid,
  actor_role     text,
  actor_tipo     text NOT NULL DEFAULT 'desconhecido',
  acao           text NOT NULL DEFAULT 'update',
  motivo         text,
  tenant_snapshot uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_liberado_app_audit_prestador
  ON public.liberado_app_audit (prestador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_liberado_app_audit_created
  ON public.liberado_app_audit (created_at DESC);

REVOKE ALL ON public.liberado_app_audit FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.liberado_app_audit FROM authenticated;
GRANT SELECT ON public.liberado_app_audit TO authenticated, service_role;

ALTER TABLE public.liberado_app_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liberado_app_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS laa_select_tms ON public.liberado_app_audit;
CREATE POLICY laa_select_tms
  ON public.liberado_app_audit FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()));

-- [2] GUARDA - BEFORE UPDATE (SECURITY INVOKER: precisa do contexto real da sessao)
-- Prova de contexto autorizado: service_role | tenant_usuarios | owner/super.
-- NAO confia em current_setting('role') isoladamente.
CREATE OR REPLACE FUNCTION public.fn_guardar_privilegio_prestador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_priv constant text[] := ARRAY[
    'liberado_app','status','status_operacional','data_aprovacao','auth_user_id',
    'origem_cadastro','score_interno','ultimo_usuario','cpf_cnpj','rg','rg_ie',
    'data_nascimento','observacoes','observacoes_torre','avaliacao_operacional',
    'indice_comparecimento','indice_entrega_prazo','indice_aceite','qtd_operacoes',
    'banco','agencia','conta','digito','tipo_conta','favorecido','cpf_cnpj_favorecido',
    'chave_pix','tipo_chave_pix','retencoes','retencoes_descontos',
    'conta_contabil','centro_custo',
    'valor_diaria','valor_km','valor_saida','fixo_mensal','valor_ajudante',
    'valor_espera','valor_reentrega','valor_devolucao',
    'periodicidade_pagamento','prazo_pagamento','forma_preferencial',
    'forma_preferencial_pagamento'];
  -- chaves de metadata que o APP tem contrato real para escrever
  -- (driver_profile_repository.dart: setDisponivel / updateStatusOperacional)
  c_meta_allow constant text[] := ARRAY['disponivel_app','status_operacional_app'];

  v_uid          uuid;
  v_role         text;
  v_authorized   boolean := false;
  v_changed      text[]  := ARRAY[]::text[];
  v_meta_changed text[]  := ARRAY[]::text[];
  v_meta_extra   text[]  := ARRAY[]::text[];
  v_col          text;
BEGIN
  v_uid  := auth.uid();
  v_role := coalesce(auth.role(), current_setting('role', true), 'anon');

  IF v_role = 'service_role' THEN
    v_authorized := true;
  ELSIF current_user IN ('postgres','supabase_admin')
        OR current_setting('is_superuser')::boolean THEN
    v_authorized := true;
  ELSIF v_uid IS NOT NULL AND EXISTS (
          SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = v_uid) THEN
    v_authorized := true;
  END IF;

  IF v_authorized THEN
    RETURN NEW;
  END IF;

  FOR v_col IN SELECT unnest(c_priv) LOOP
    IF to_jsonb(NEW) -> v_col IS DISTINCT FROM to_jsonb(OLD) -> v_col THEN
      v_changed := v_changed || v_col;
    END IF;
  END LOOP;

  IF cardinality(v_changed) > 0 THEN
    RAISE LOG 'ADM-APP-02C.2 BLOQUEADO (A-9): role=% uid=% campos=%',
              v_role, v_uid, array_to_string(v_changed, ',');
    RAISE EXCEPTION
      'ADM-APP-02C.2: alteracao de campo privilegiado de prestador negada (campos: %)',
      array_to_string(v_changed, ',')
      USING ERRCODE = '42501',
            HINT   = 'Somente TMS (tenant_usuarios), service_role ou o owner do banco alteram estes campos.';
  END IF;

  IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    SELECT array_agg(k) INTO v_meta_changed
      FROM (SELECT coalesce(a.key, b.key) AS k
              FROM jsonb_each(coalesce(OLD.metadata, '{}'::jsonb)) a
              FULL JOIN jsonb_each(coalesce(NEW.metadata, '{}'::jsonb)) b
                ON a.key = b.key
             WHERE coalesce(a.value::text, ' ')
                   IS DISTINCT FROM coalesce(b.value::text, ' ')) s;

    IF cardinality(coalesce(v_meta_changed, ARRAY[]::text[])) > 0 THEN
      SELECT array_agg(k) INTO v_meta_extra
        FROM unnest(v_meta_changed) k WHERE NOT (k = ANY (c_meta_allow));

      IF cardinality(coalesce(v_meta_extra, ARRAY[]::text[])) > 0 THEN
        RAISE LOG 'ADM-APP-02C.2 BLOQUEADO (A-9 metadata): role=% uid=% chaves=%',
                  v_role, v_uid, array_to_string(v_meta_extra, ',');
        RAISE EXCEPTION
          'ADM-APP-02C.2: alteracao de metadata com chaves privilegiadas negada (chaves: %)',
          array_to_string(v_meta_extra, ',')
          USING ERRCODE = '42501',
                HINT   = 'O APP so pode alterar metadata.disponivel_app e metadata.status_operacional_app.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guardar_privilegio_prestador ON public.prestadores;
CREATE TRIGGER trg_guardar_privilegio_prestador
  BEFORE UPDATE ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guardar_privilegio_prestador();

-- [3] AUDITORIA - AFTER UPDATE (SECURITY DEFINER: nunca bloqueia o writer)
-- WHO / WHAT / OLD / NEW / WHEN
CREATE OR REPLACE FUNCTION public.fn_audit_liberado_app()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_priv constant text[] := ARRAY[
    'liberado_app','status','status_operacional','data_aprovacao','auth_user_id',
    'origem_cadastro','score_interno','ultimo_usuario','cpf_cnpj','rg','rg_ie',
    'data_nascimento','observacoes','observacoes_torre','avaliacao_operacional',
    'indice_comparecimento','indice_entrega_prazo','indice_aceite','qtd_operacoes',
    'banco','agencia','conta','digito','tipo_conta','favorecido','cpf_cnpj_favorecido',
    'chave_pix','tipo_chave_pix','retencoes','retencoes_descontos',
    'conta_contabil','centro_custo',
    'valor_diaria','valor_km','valor_saida','fixo_mensal','valor_ajudante',
    'valor_espera','valor_reentrega','valor_devolucao',
    'periodicidade_pagamento','prazo_pagamento','forma_preferencial',
    'forma_preferencial_pagamento'];
  c_meta_allow constant text[] := ARRAY['disponivel_app','status_operacional_app'];
  v_uid    uuid := auth.uid();
  v_role   text := coalesce(auth.role(), current_setting('role', true), 'anon');
  v_tipo   text;
  v_motivo text;
  v_col    text;
  v_meta_changed text[];
BEGIN
  v_tipo := CASE
              WHEN v_role = 'service_role' THEN 'service_role'
              WHEN v_uid IS NULL           THEN 'anon'
              WHEN EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.user_id = v_uid)
                                           THEN 'tms'
              ELSE 'prestador'
            END;
  v_motivo := nullif(current_setting('app.audit_motivo', true), '');

  BEGIN
    FOR v_col IN SELECT unnest(c_priv) LOOP
      IF to_jsonb(NEW) -> v_col IS DISTINCT FROM to_jsonb(OLD) -> v_col THEN
        INSERT INTO public.liberado_app_audit
          (prestador_id, campo, valor_anterior, valor_novo,
           actor_user_id, actor_role, actor_tipo, acao, motivo, tenant_snapshot)
        VALUES
          (NEW.id, v_col,
           left(coalesce(to_jsonb(OLD) ->> v_col, ''), 4000),
           left(coalesce(to_jsonb(NEW) ->> v_col, ''), 4000),
           v_uid, v_role, v_tipo, 'update', v_motivo, public.current_tenant_id_safe());
      END IF;
    END LOOP;

    IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      SELECT array_agg(k) INTO v_meta_changed
        FROM (SELECT coalesce(a.key, b.key) AS k
                FROM jsonb_each(coalesce(OLD.metadata, '{}'::jsonb)) a
                FULL JOIN jsonb_each(coalesce(NEW.metadata, '{}'::jsonb)) b
                  ON a.key = b.key
               WHERE coalesce(a.value::text, ' ')
                     IS DISTINCT FROM coalesce(b.value::text, ' ')) s;

      IF cardinality(coalesce(v_meta_changed, ARRAY[]::text[])) > 0
         AND NOT EXISTS (SELECT 1 FROM unnest(v_meta_changed) k
                          WHERE NOT (k = ANY (c_meta_allow))) THEN
        INSERT INTO public.liberado_app_audit
          (prestador_id, campo, valor_anterior, valor_novo,
           actor_user_id, actor_role, actor_tipo, acao, motivo, tenant_snapshot)
        VALUES
          (NEW.id, 'metadata',
           left(coalesce(OLD.metadata::text, ''), 4000),
           left(coalesce(NEW.metadata::text, ''), 4000),
           v_uid, v_role, v_tipo, 'update', v_motivo, public.current_tenant_id_safe());
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'ADM-APP-02C.2 auditoria ignorada (nao bloqueia): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_liberado_app ON public.prestadores;
CREATE TRIGGER trg_audit_liberado_app
  AFTER UPDATE ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_liberado_app();

-- [4] A-8 - SELECT do prestador limitado ao PROPRIO cadastro
-- (removido "auth_user_id IS NULL" que deixava 34 cadastros alheios visiveis)
DROP POLICY IF EXISTS prestadores_select_own ON public.prestadores;
CREATE POLICY prestadores_select_own
  ON public.prestadores FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
-- demais policies de prestadores (tms/portal/update_own/insert/delete) PRESERVADAS.

-- [5] RLS de recrutamento restrito ao TMS (4 tabelas)
-- service_role: BYPASSRLS (verificado em 02C.2) - segue operando.
-- bridge f_bridge_prestador_para_recrutamento e SECURITY DEFINER (owner) - preservada.
DO $$
DECLARE
  t text;
  p text;
  tab constant text[] := ARRAY['recrutamento_candidatos','recrutamento_prestadores',
                               'recrutamento_operacoes','candidato_documentos'];
  g constant text := 'EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid())';
BEGIN
  FOREACH t IN ARRAY tab LOOP
    FOR p IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   t || '_tms_select', t, g);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   t || '_tms_insert', t, g);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   t || '_tms_update', t, g, g);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                   t || '_tms_delete', t, g);
  END LOOP;
END;
$$;

-- [6] Tabela legada candidatos: fecha acesso anon (buraco da 02C.1)
-- /cadastro-prestador escreve em recrutamento_candidatos e NAO em candidatos
-- (confirmado em 02C.2 via criarCandidatoService.ts:41) - fechar e seguro.
REVOKE ALL ON public.candidatos FROM anon;
REVOKE ALL ON public.candidatos FROM authenticated;
GRANT SELECT ON public.candidatos TO authenticated, service_role;

DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname='public' AND tablename='candidatos' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.candidatos', p);
  END LOOP;
END;
$$;

CREATE POLICY candidatos_tms_select ON public.candidatos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()));
CREATE POLICY candidatos_tms_insert ON public.candidatos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()));
CREATE POLICY candidatos_tms_update ON public.candidatos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()));
CREATE POLICY candidatos_tms_delete ON public.candidatos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE tenant_usuarios.user_id = auth.uid()));

COMMIT;
