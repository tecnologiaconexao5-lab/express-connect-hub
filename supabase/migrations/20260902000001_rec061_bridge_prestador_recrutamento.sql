-- ============================================================
-- MIGRATION: 20260902_rec061_bridge_prestador_recrutamento
-- PROJETO: TMS Conexão Express Hub
-- FASE: REC-06.1 — Bridge Canônico APP → Recrutamento
-- DESCRIÇÃO:
--   Cria trigger que automaticamente insere em recrutamento_prestadores
--   e recrutamento_candidatos quando um prestador é criado com
--   origem = 'app_prestador' ou origem_cadastro = 'app_motorista'.
--
--   ARQUITETURA:
--   - AFTER INSERT ON prestadores (tabela operacional)
--   - Cria recrutamento_prestadores (tabela de recrutamento — FK target)
--   - Cria recrutamento_candidatos (pipeline — FK para recrutamento_prestadores)
--
--   SEGURANÇA:
--   - Idempotente: verifica se já existe recrutamento_prestadores com mesmo cpf_cnpj
--   - Fail-closed: stage = 'novo_cadastro', liberado_app NÃO é alterado
--   - NÃO aprova, NÃO libera, APENAS garante entrada no pipeline
-- ============================================================

CREATE OR REPLACE FUNCTION public.f_bridge_prestador_para_recrutamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rp_id UUID;
  v_exists BOOLEAN;
  v_candidato_id UUID;
  v_nome TEXT;
  v_telefone TEXT;
  v_email TEXT;
  v_cidade TEXT;
  v_uf TEXT;
  v_tipo_veiculo TEXT;
  v_placa TEXT;
  v_cpf TEXT;
  v_now TEXT;
  v_tags JSONB;
BEGIN
  -- ====================================================================
  -- GUARD 1: Só processa prestadores de origem App
  -- ====================================================================
  IF NEW.origem != 'app_prestador' AND NEW.origem_cadastro != 'app_motorista' THEN
    RETURN NEW;
  END IF;

  -- ====================================================================
  -- EXTRACT: Dados do prestador operacional
  -- ====================================================================
  v_now := to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_nome := COALESCE(NEW.nome_completo, 'Sem nome');
  v_telefone := COALESCE(NEW.telefone, NEW.whatsapp, '');
  v_email := COALESCE(NEW.email, '');
  v_cidade := COALESCE(NEW.endereco->>'cidade', '');
  v_uf := COALESCE(NEW.endereco->>'uf', NEW.endereco->>'estado', '');
  v_cpf := COALESCE(NEW.cpf_cnpj, '');

  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'veiculo' THEN
    v_tipo_veiculo := COALESCE(NEW.metadata->'veiculo'->>'tipo', '');
    v_placa := COALESCE(NEW.metadata->'veiculo'->>'placa', '');
  ELSE
    v_tipo_veiculo := '';
    v_placa := '';
  END IF;

  -- ====================================================================
  -- GUARD 2: Idempotência — já existe recrutamento_prestadores com mesmo CPF?
  -- ====================================================================
  IF v_cpf != '' THEN
    SELECT id INTO v_rp_id
    FROM public.recrutamento_prestadores
    WHERE cpf_cnpj = v_cpf
    LIMIT 1;
  END IF;

  -- ====================================================================
  -- STEP 1: Criar recrutamento_prestadores (FK target)
  -- ====================================================================
  IF v_rp_id IS NULL THEN
    INSERT INTO public.recrutamento_prestadores (
      nome, cpf_cnpj, contatos, endereco, tipo_veiculo, placa_veiculo,
      status, origem_cadastro, data_cadastro, ultima_atividade,
      created_at, updated_at
    ) VALUES (
      v_nome, v_cpf,
      jsonb_build_array(
        jsonb_build_object('tipo', 'telefone', 'valor', v_telefone, 'principal', true),
        jsonb_build_object('tipo', 'email', 'valor', v_email, 'principal', false)
      ),
      jsonb_build_object('cidade', v_cidade, 'estado', v_uf),
      v_tipo_veiculo, v_placa,
      'novo', 'app_motorista', v_now, v_now,
      NOW(), NOW()
    )
    RETURNING id INTO v_rp_id;

    RAISE NOTICE 'REC-06.1 BRIDGE: recrutamento_prestadores % criado para prestador %', v_rp_id, NEW.id;
  ELSE
    RAISE NOTICE 'REC-06.1 BRIDGE: recrutamento_prestadores % já existe (cpf %) — reutilizando', v_rp_id, v_cpf;
  END IF;

  -- ====================================================================
  -- GUARD 3: Idempotência — já existe candidato vinculado a este recrutamento_prestadores?
  -- ====================================================================
  SELECT EXISTS(
    SELECT 1 FROM public.recrutamento_candidatos
    WHERE prestador_id = v_rp_id
    LIMIT 1
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'REC-06.1 BRIDGE: candidato já existe para recrutamento_prestadores % — skip', v_rp_id;
    RETURN NEW;
  END IF;

  -- ====================================================================
  -- STEP 2: Criar recrutamento_candidatos (pipeline)
  -- ====================================================================
  v_tags := jsonb_build_array(
    'app_motorista',
    'bridge_automatico',
    'origem:' || COALESCE(NEW.origem, 'app_prestador')
  );

  INSERT INTO public.recrutamento_candidatos (
    nome, telefone, email, cidade, uf, veiculo, placa,
    stage, status_documental, prioridade, validade_cnh,
    tags, observacoes_ia, data_entrada, data_atualizacao,
    prestador_id, created_at, updated_at
  ) VALUES (
    v_nome, v_telefone, v_email, v_cidade, v_uf, v_tipo_veiculo, v_placa,
    'novo_cadastro', 'pendente', 'normal', '',
    v_tags,
    '[REC-06.1] Candidato criado via bridge prestador→recrutamento. Prestador ID: ' || NEW.id || '. Auth User ID: ' || COALESCE(NEW.auth_user_id::text, 'N/A'),
    v_now, v_now,
    v_rp_id, NOW(), NOW()
  )
  RETURNING id INTO v_candidato_id;

  RAISE NOTICE 'REC-06.1 BRIDGE: candidato % criado para prestador % via recrutamento_prestadores %',
    v_candidato_id, NEW.id, v_rp_id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_bridge_prestador_para_recrutamento ON public.prestadores;

CREATE TRIGGER trg_bridge_prestador_para_recrutamento
  AFTER INSERT ON public.prestadores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_bridge_prestador_para_recrutamento();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON FUNCTION public.f_bridge_prestador_para_recrutamento() IS
  'REC-06.1 Bridge canônico: prestadores (operacional) → recrutamento_prestadores (recrutamento) → recrutamento_candidatos (pipeline). '
  'Idempotente: skip se candidato já existe para mesmo recrutamento_prestadores. '
  'Fail-closed: stage=novo_cadastro, liberado_app não alterado.';

COMMENT ON TRIGGER trg_bridge_prestador_para_recrutamento ON public.prestadores IS
  'REC-06.1 Bridge: AFTER INSERT → cria recrutamento_prestadores + recrutamento_candidatos quando origem=app_prestador.';
