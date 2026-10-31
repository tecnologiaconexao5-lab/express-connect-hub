-- =============================================================================
-- TALENT INTELLIGENCE — FASE 1 + 2
-- Data: 2026-10-31
--
-- Escopo (somente banco + sincronização com o App):
--   1. Perfil profissional 1:1 do prestador (`prestador_perfil_talento`);
--   2. Evolução das janelas de disponibilidade (`prestador_disponibilidade`);
--   3. Cenários e avaliações situacionais de recrutamento;
--   4. RPC de sincronização (`app_s6_salvar_perfil_talento`) + gancho na
--      `app_s6_criar_prestador` (idempotência por auth_user_id preservada).
--
-- Nenhuma tela do TMS/Dashboard é alterada por esta migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PERFIL PROFISSIONAL (1:1 com prestadores)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prestador_perfil_talento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  tenant_id uuid DEFAULT public.current_tenant_id_safe(),
  modalidade_preferencial text[] DEFAULT '{}'::text[],
  distancia_max_coleta_km integer,
  aceita_viagens boolean DEFAULT true,
  restricoes_operacionais jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_prestador_perfil_talento_prestador UNIQUE (prestador_id),
  CONSTRAINT chk_prestador_perfil_talento_distancia
    CHECK (distancia_max_coleta_km IS NULL OR distancia_max_coleta_km >= 0)
);

CREATE INDEX IF NOT EXISTS idx_prestador_perfil_talento_tenant
  ON public.prestador_perfil_talento (tenant_id);

DROP TRIGGER IF EXISTS trg_prestador_perfil_talento_updated_at
  ON public.prestador_perfil_talento;
CREATE TRIGGER trg_prestador_perfil_talento_updated_at
  BEFORE UPDATE ON public.prestador_perfil_talento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.prestador_perfil_talento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppt_select_tms" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_select_tms" ON public.prestador_perfil_talento
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ppt_select_own" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_select_own" ON public.prestador_perfil_talento
  FOR SELECT TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ppt_insert_tms" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_insert_tms" ON public.prestador_perfil_talento
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ppt_insert_own" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_insert_own" ON public.prestador_perfil_talento
  FOR INSERT TO authenticated
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ppt_update_tms" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_update_tms" ON public.prestador_perfil_talento
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ppt_update_own" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_update_own" ON public.prestador_perfil_talento
  FOR UPDATE TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ppt_delete_tms" ON public.prestador_perfil_talento;
CREATE POLICY "ppt_delete_tms" ON public.prestador_perfil_talento
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_perfil_talento TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. JANELAS DE HORÁRIO — evolução de prestador_disponibilidade
-- ---------------------------------------------------------------------------
ALTER TABLE public.prestador_disponibilidade
  ADD COLUMN IF NOT EXISTS dia_semana integer,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prestador_disponibilidade_dia_semana'
      AND conrelid = 'public.prestador_disponibilidade'::regclass
  ) THEN
    ALTER TABLE public.prestador_disponibilidade
      ADD CONSTRAINT chk_prestador_disponibilidade_dia_semana
      CHECK (dia_semana IS NULL OR (dia_semana >= 0 AND dia_semana <= 6));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prestador_disponibilidade_horario'
      AND conrelid = 'public.prestador_disponibilidade'::regclass
  ) THEN
    ALTER TABLE public.prestador_disponibilidade
      ADD CONSTRAINT chk_prestador_disponibilidade_horario
      CHECK (
        hora_inicio IS NULL OR hora_fim IS NULL OR hora_fim > hora_inicio
      );
  END IF;
END $$;

-- A tabela estava ociosa e possuía UNIQUE(prestador_id), o que impediria
-- várias janelas por prestador. Substituímos pelo índice combinado pedido.
DROP INDEX IF EXISTS public.idx_unique_disponibilidade;

CREATE INDEX IF NOT EXISTS idx_prestador_disponibilidade_dia
  ON public.prestador_disponibilidade (prestador_id, dia_semana);

-- RLS padrão para leitura/escrita das janelas (TMS + próprio prestador).
ALTER TABLE public.prestador_disponibilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdisp_select_tms" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_select_tms" ON public.prestador_disponibilidade
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pdisp_select_own" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_select_own" ON public.prestador_disponibilidade
  FOR SELECT TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pdisp_insert_tms" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_insert_tms" ON public.prestador_disponibilidade
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pdisp_insert_own" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_insert_own" ON public.prestador_disponibilidade
  FOR INSERT TO authenticated
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pdisp_update_tms" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_update_tms" ON public.prestador_disponibilidade
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pdisp_update_own" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_update_own" ON public.prestador_disponibilidade
  FOR UPDATE TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pdisp_delete_tms" ON public.prestador_disponibilidade;
CREATE POLICY "pdisp_delete_tms" ON public.prestador_disponibilidade
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_disponibilidade TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. AVALIAÇÃO SITUACIONAL (cenários + avaliações)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recrutamento_cenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao_situacao text NOT NULL,
  competencia_alvo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_recrutamento_cenarios_updated_at
  ON public.recrutamento_cenarios;
CREATE TRIGGER trg_recrutamento_cenarios_updated_at
  BEFORE UPDATE ON public.recrutamento_cenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recrutamento_cenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcen_select_auth" ON public.recrutamento_cenarios;
CREATE POLICY "rcen_select_auth" ON public.recrutamento_cenarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rcen_insert_tms" ON public.recrutamento_cenarios;
CREATE POLICY "rcen_insert_tms" ON public.recrutamento_cenarios
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rcen_update_tms" ON public.recrutamento_cenarios;
CREATE POLICY "rcen_update_tms" ON public.recrutamento_cenarios
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rcen_delete_tms" ON public.recrutamento_cenarios;
CREATE POLICY "rcen_delete_tms" ON public.recrutamento_cenarios
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recrutamento_cenarios TO authenticated;

CREATE TABLE IF NOT EXISTS public.recrutamento_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  cenario_id uuid NOT NULL REFERENCES public.recrutamento_cenarios(id) ON DELETE CASCADE,
  resposta_candidato text,
  pontuacao numeric(5,2),
  analise_ia_jsonb jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_recrutamento_avaliacoes_pontuacao
    CHECK (pontuacao IS NULL OR (pontuacao >= 0 AND pontuacao <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recrutamento_avaliacoes_prestador_cenario
  ON public.recrutamento_avaliacoes (prestador_id, cenario_id);

CREATE INDEX IF NOT EXISTS idx_recrutamento_avaliacoes_prestador
  ON public.recrutamento_avaliacoes (prestador_id);

DROP TRIGGER IF EXISTS trg_recrutamento_avaliacoes_updated_at
  ON public.recrutamento_avaliacoes;
CREATE TRIGGER trg_recrutamento_avaliacoes_updated_at
  BEFORE UPDATE ON public.recrutamento_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recrutamento_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rav_select_tms" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_select_tms" ON public.recrutamento_avaliacoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rav_select_own" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_select_own" ON public.recrutamento_avaliacoes
  FOR SELECT TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rav_insert_tms" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_insert_tms" ON public.recrutamento_avaliacoes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rav_insert_own" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_insert_own" ON public.recrutamento_avaliacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rav_update_tms" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_update_tms" ON public.recrutamento_avaliacoes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rav_update_own" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_update_own" ON public.recrutamento_avaliacoes
  FOR UPDATE TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rav_delete_tms" ON public.recrutamento_avaliacoes;
CREATE POLICY "rav_delete_tms" ON public.recrutamento_avaliacoes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recrutamento_avaliacoes TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. SINCRONIZAÇÃO COM O APP
-- ---------------------------------------------------------------------------

-- Salva/atualiza o perfil de talento do prestador autenticado e suas janelas.
-- Idempotente: sempre localiza o prestador por auth_user_id (mesmo vínculo da
-- app_s6_criar_prestador). Não recebe prestador_id do cliente.
CREATE OR REPLACE FUNCTION public.app_s6_salvar_perfil_talento(
  p_modalidade_preferencial text[] DEFAULT NULL,
  p_distancia_max_coleta_km integer DEFAULT NULL,
  p_aceita_viagens boolean DEFAULT NULL,
  p_restricoes_operacionais jsonb DEFAULT NULL,
  p_disponibilidade jsonb DEFAULT NULL,
  p_avaliacoes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_prestador_id uuid;
  v_tenant_id uuid;
  v_perfil_id uuid;
  v_item jsonb;
  v_cenario_id uuid;
  v_total_disp integer := 0;
  v_total_aval integer := 0;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_auth_uid
  ORDER BY created_at
  LIMIT 1;

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PRESTADOR_NAO_ENCONTRADO',
      'message', 'Nenhum prestador vinculado a este usuário.'
    );
  END IF;

  v_tenant_id := COALESCE(
    public.current_tenant_id_safe(),
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO public.prestador_perfil_talento (
    prestador_id, tenant_id, modalidade_preferencial, distancia_max_coleta_km,
    aceita_viagens, restricoes_operacionais, created_at, updated_at
  ) VALUES (
    v_prestador_id,
    v_tenant_id,
    p_modalidade_preferencial,
    p_distancia_max_coleta_km,
    COALESCE(p_aceita_viagens, true),
    COALESCE(p_restricoes_operacionais, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (prestador_id) DO UPDATE SET
    tenant_id = COALESCE(EXCLUDED.tenant_id, prestador_perfil_talento.tenant_id),
    modalidade_preferencial = COALESCE(
      EXCLUDED.modalidade_preferencial,
      prestador_perfil_talento.modalidade_preferencial
    ),
    distancia_max_coleta_km = COALESCE(
      EXCLUDED.distancia_max_coleta_km,
      prestador_perfil_talento.distancia_max_coleta_km
    ),
    aceita_viagens = CASE
      WHEN p_aceita_viagens IS NULL THEN prestador_perfil_talento.aceita_viagens
      ELSE EXCLUDED.aceita_viagens
    END,
    restricoes_operacionais = CASE
      WHEN p_restricoes_operacionais IS NULL THEN prestador_perfil_talento.restricoes_operacionais
      ELSE EXCLUDED.restricoes_operacionais
    END,
    updated_at = now()
  RETURNING id INTO v_perfil_id;

  -- Janelas de horário: substitui as janelas anteriores quando enviadas.
  IF p_disponibilidade IS NOT NULL AND jsonb_typeof(p_disponibilidade) = 'array' THEN
    DELETE FROM public.prestador_disponibilidade WHERE prestador_id = v_prestador_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_disponibilidade) LOOP
      IF NULLIF(v_item ->> 'dia_semana', '') IS NOT NULL THEN
        INSERT INTO public.prestador_disponibilidade (
          prestador_id, dia_semana, hora_inicio, hora_fim, disponivel, updated_at
        ) VALUES (
          v_prestador_id,
          (v_item ->> 'dia_semana')::integer,
          NULLIF(v_item ->> 'hora_inicio', '')::time,
          NULLIF(v_item ->> 'hora_fim', '')::time,
          COALESCE((v_item ->> 'disponivel')::boolean, true),
          now()
        );
        v_total_disp := v_total_disp + 1;
      END IF;
    END LOOP;
  END IF;

  -- Avaliações situacionais: upsert por (prestador, cenário).
  IF p_avaliacoes IS NOT NULL AND jsonb_typeof(p_avaliacoes) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_avaliacoes) LOOP
      v_cenario_id := NULLIF(v_item ->> 'cenario_id', '')::uuid;

      IF v_cenario_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.recrutamento_cenarios WHERE id = v_cenario_id) THEN
        INSERT INTO public.recrutamento_avaliacoes (
          prestador_id, cenario_id, resposta_candidato, pontuacao,
          analise_ia_jsonb, created_at, updated_at
        ) VALUES (
          v_prestador_id,
          v_cenario_id,
          NULLIF(v_item ->> 'resposta_candidato', ''),
          NULLIF(v_item ->> 'pontuacao', '')::numeric,
          COALESCE(v_item -> 'analise_ia_jsonb', '{}'::jsonb),
          now(),
          now()
        )
        ON CONFLICT (prestador_id, cenario_id) DO UPDATE SET
          resposta_candidato = COALESCE(
            EXCLUDED.resposta_candidato,
            recrutamento_avaliacoes.resposta_candidato
          ),
          pontuacao = COALESCE(EXCLUDED.pontuacao, recrutamento_avaliacoes.pontuacao),
          analise_ia_jsonb = COALESCE(
            EXCLUDED.analise_ia_jsonb,
            recrutamento_avaliacoes.analise_ia_jsonb
          ),
          updated_at = now();

        v_total_aval := v_total_aval + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'prestador_id', v_prestador_id,
    'perfil_id', v_perfil_id,
    'disponibilidade_salva', v_total_disp,
    'avaliacoes_salvas', v_total_aval
  );
END;
$$;

REVOKE ALL ON FUNCTION public.app_s6_salvar_perfil_talento(
  TEXT[], INTEGER, BOOLEAN, JSONB, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_s6_salvar_perfil_talento(
  TEXT[], INTEGER, BOOLEAN, JSONB, JSONB, JSONB
) TO authenticated;

-- Atualiza a RPC de criação do App para também alimentar o perfil de talento.
-- Mesma assinatura pública; idempotência por auth_user_id preservada.
CREATE OR REPLACE FUNCTION public.app_s6_criar_prestador(
  p_nome_completo  TEXT,
  p_cpf_cnpj       TEXT DEFAULT NULL,
  p_data_nascimento TEXT DEFAULT NULL,
  p_telefone       TEXT DEFAULT NULL,
  p_email          TEXT DEFAULT NULL,
  p_auth_email     TEXT DEFAULT NULL,
  p_senha          TEXT DEFAULT NULL,
  p_status         TEXT DEFAULT 'em_analise',
  p_origem         TEXT DEFAULT 'app_prestador',
  p_liberado_app   BOOLEAN DEFAULT FALSE,
  p_metadata       JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid UUID;
  v_existing_id UUID;
  v_new_id UUID;
  v_nome TEXT;
  v_cpf TEXT;
  v_telefone TEXT;
  v_email TEXT;
  v_meta JSONB;
  v_perfil JSONB;
  v_disponibilidade JSONB;
  v_avaliacoes JSONB;
  v_modalidades TEXT[];
  v_distancia INTEGER;
  v_aceita_viagens BOOLEAN;
  v_restricoes JSONB;
  v_tem_talento BOOLEAN := FALSE;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado'
      USING ERRCODE = 'P0001';
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb);

  -- Perfil pode vir em metadata.perfil_talento ou direto na raiz do metadata.
  v_perfil := CASE
    WHEN jsonb_typeof(v_meta -> 'perfil_talento') = 'object' THEN v_meta -> 'perfil_talento'
    ELSE v_meta
  END;
  v_disponibilidade := CASE
    WHEN jsonb_typeof(v_meta -> 'disponibilidade') = 'array' THEN v_meta -> 'disponibilidade'
    ELSE NULL
  END;
  v_avaliacoes := CASE
    WHEN jsonb_typeof(v_meta -> 'avaliacoes') = 'array' THEN v_meta -> 'avaliacoes'
    ELSE NULL
  END;

  v_modalidades := CASE
    WHEN jsonb_typeof(v_perfil -> 'modalidade_preferencial') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(v_perfil -> 'modalidade_preferencial'))
    ELSE NULL
  END;

  v_distancia := CASE
    WHEN NULLIF(v_perfil ->> 'distancia_max_coleta_km', '') IS NOT NULL
      THEN (v_perfil ->> 'distancia_max_coleta_km')::integer
    ELSE NULL
  END;

  v_aceita_viagens := CASE
    WHEN NULLIF(v_perfil ->> 'aceita_viagens', '') IS NOT NULL
      THEN (v_perfil ->> 'aceita_viagens')::boolean
    ELSE NULL
  END;

  v_restricoes := CASE
    WHEN jsonb_typeof(v_perfil -> 'restricoes_operacionais') = 'object'
      THEN v_perfil -> 'restricoes_operacionais'
    ELSE NULL
  END;

  v_tem_talento := (v_meta ? 'perfil_talento')
    OR (v_meta ? 'modalidade_preferencial')
    OR (v_meta ? 'distancia_max_coleta_km')
    OR (v_meta ? 'aceita_viagens')
    OR (v_meta ? 'restricoes_operacionais')
    OR v_disponibilidade IS NOT NULL
    OR v_avaliacoes IS NOT NULL;

  -- Idempotência: reusa o prestador do auth.uid() quando já existir.
  SELECT id INTO v_existing_id
  FROM public.prestadores
  WHERE auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_new_id := v_existing_id;
  ELSE
    v_nome := trim(COALESCE(p_nome_completo, ''));
    IF v_nome = '' THEN
      RAISE EXCEPTION 'Nome completo é obrigatório'
        USING ERRCODE = 'P0002';
    END IF;

    v_cpf := CASE WHEN trim(COALESCE(p_cpf_cnpj, '')) = '' THEN NULL
                  ELSE trim(p_cpf_cnpj) END;
    v_telefone := CASE WHEN trim(COALESCE(p_telefone, '')) = '' THEN NULL
                       ELSE trim(p_telefone) END;
    v_email := CASE WHEN trim(COALESCE(p_email, '')) = '' THEN NULL
                    ELSE trim(p_email) END;

    INSERT INTO public.prestadores (
      nome_completo, cpf_cnpj, data_nascimento, telefone, email,
      auth_user_id, status, liberado_app, origem, origem_cadastro,
      metadata, created_at, updated_at
    ) VALUES (
      v_nome,
      v_cpf,
      CASE WHEN p_data_nascimento IS NOT NULL AND trim(p_data_nascimento) != ''
           THEN p_data_nascimento::date ELSE NULL END,
      v_telefone,
      v_email,
      v_auth_uid,
      'em_analise',
      false,
      COALESCE(p_origem, 'app_prestador'),
      'app_motorista',
      v_meta,
      now(),
      now()
    )
    RETURNING id INTO v_new_id;
  END IF;

  IF v_tem_talento THEN
    PERFORM public.app_s6_salvar_perfil_talento(
      v_modalidades,
      v_distancia,
      v_aceita_viagens,
      v_restricoes,
      v_disponibilidade,
      v_avaliacoes
    );
  END IF;

  RETURN jsonb_build_object('prestador_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.app_s6_criar_prestador(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_s6_criar_prestador(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB
) TO authenticated;

NOTIFY pgrst, 'reload schema';
