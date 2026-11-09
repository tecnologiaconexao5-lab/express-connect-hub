-- ============================================================================
-- COTAÇÃO EXPRESS → OS — CORREÇÕES DE BASE (LOTE 1)
-- Data: 2026-11-09
-- Alvo: Supabase do TMS (uwrvzsjtpgaifkktpepn)
--
-- 1) FUSO HORÁRIO
--    `ordens_servico.created_at/updated_at` são `timestamp without time zone`.
--    Gravar `now()` (UTC) fazia a tela exibir "Solicitada" +3h (09:38 → 12:36).
--    A OS passa a gravar o horário local de São Paulo (UTC-3).
--
-- 2) CLIENTE (NOME + TELEFONE)
--    A OS herda exatamente o nome/telefone digitados na cotação:
--    dedup por nome; se casar só por telefone, renomeia o cadastro para o
--    nome da cotação (sem duplicar); telefone sempre sincronizado.
--
-- 3) ENDEREÇOS DESMEMBRADOS
--    A Fase 1 passa a persistir `paradas[].enderecoDetalhado` (Rua/Número/
--    Bairro/Cidade/UF/CEP/lat/lng vindos do Mapbox/ViaCEP). A conversão
--    preenche logradouro/numero/bairro/cidade/uf/estado/cep e monta o
--    `endereco` completo (o roteirizador deixa de receber só a cidade/CEP).
--    Cotações legadas sem estrutura usam parsing do texto como fallback.
--
-- 4) STATUS INICIAL
--    A OS nasce 'em_analise' (não mais 'pendente' → 'rascunho').
--    A blindagem 'aguardando' mantém 'em_analise' com a marca de confirmação.
--
-- Reaplicar é seguro (CREATE OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Parser de endereço textual (fallback para cotações legadas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_parse_endereco_cotacao(p_texto text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_texto  text := btrim(COALESCE(p_texto, ''));
  v_partes text[];
  v_n      int;
  v_cep    text := '';
  v_uf     text := '';
  v_rua    text := '';
  v_numero text := '';
  v_bairro text := '';
  v_cidade text := '';
  v_seg2   text;
BEGIN
  IF v_texto = '' THEN
    RETURN jsonb_build_object(
      'logradouro', '', 'numero', '', 'bairro', '', 'cidade', '', 'uf', '', 'cep', ''
    );
  END IF;

  -- CEP (8 dígitos, com ou sem hífen) e "Brasil" saem do texto.
  v_cep := COALESCE((regexp_match(v_texto, '([0-9]{5}-?[0-9]{3})'))[1], '');
  v_texto := btrim(regexp_replace(v_texto, '[, ]*[0-9]{5}-?[0-9]{3}\s*$', ''));
  v_texto := btrim(regexp_replace(v_texto, ',?\s*Brasil\s*$', '', 'i'));

  -- UF ("Cidade - SP" ou ", SP").
  v_uf := COALESCE(
    (regexp_match(v_texto, '[-–]\s*([A-Z]{2})\s*$'))[1],
    (regexp_match(v_texto, ',\s*([A-Z]{2})\s*$'))[1],
    ''
  );
  v_texto := btrim(regexp_replace(v_texto, '\s*[-–,]+\s*[A-Z]{2}\s*$', ''));

  v_partes := regexp_split_to_array(v_texto, '\s*,\s*');
  v_n := COALESCE(array_length(v_partes, 1), 0);

  IF v_n >= 1 THEN
    v_rua := btrim(v_partes[1]);
  END IF;

  IF v_n >= 2 THEN
    v_seg2 := btrim(v_partes[2]);
    IF v_seg2 ~ '^[0-9]' THEN
      v_numero := COALESCE((regexp_match(v_seg2, '^([0-9]+[A-Za-z]?)'))[1], '');
      v_bairro := btrim(regexp_replace(v_seg2, '^[0-9]+[A-Za-z]?[[:space:]]*[-–]?[[:space:]]*', ''));
    ELSE
      v_bairro := v_seg2;
    END IF;
  END IF;

  IF v_n >= 3 THEN
    v_cidade := btrim(v_partes[v_n]);
    IF v_bairro = '' THEN
      v_bairro := btrim(v_partes[v_n - 1]);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'logradouro', v_rua,
    'numero', v_numero,
    'bairro', v_bairro,
    'cidade', v_cidade,
    'uf', upper(v_uf),
    'cep', v_cep
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_parse_endereco_cotacao(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 1. Monta UM endereço da OS a partir da parada + detalhe da Fase 2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_endereco_cotacao_os(
  p_parada        jsonb,
  p_detalhe       jsonb,
  p_janela_inicio text,
  p_janela_fim    text,
  p_janela        text,
  p_agendamento   boolean,
  p_seq           int,
  p_tipo          text
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_det     jsonb := COALESCE(p_parada -> 'enderecoDetalhado', p_parada -> 'sugestao', '{}'::jsonb);
  v_parse   jsonb;
  v_rua     text := btrim(COALESCE(v_det ->> 'logradouro', v_det ->> 'rua', ''));
  v_numero  text := btrim(COALESCE(v_det ->> 'numero', ''));
  v_bairro  text := btrim(COALESCE(v_det ->> 'bairro', ''));
  v_cidade  text := btrim(COALESCE(v_det ->> 'cidade', ''));
  v_uf      text := upper(btrim(COALESCE(v_det ->> 'uf', '')));
  v_cep     text := btrim(COALESCE(v_det ->> 'cep', ''));
  v_num_det text := btrim(COALESCE(p_detalhe ->> 'numero', ''));
  v_compl   text := COALESCE(p_detalhe ->> 'complemento', '');
  v_obs     text := COALESCE(p_detalhe ->> 'observacoes', '');
  v_contato text := COALESCE(p_detalhe ->> 'contato', '');
  v_ref     text;
  v_end     text;
BEGIN
  -- Número confirmado na Fase 2 tem prioridade sobre o da sugestão.
  IF v_num_det <> '' THEN
    v_numero := v_num_det;
  END IF;

  -- Fallback: cotações legadas (sem enderecoDetalhado) → parsing do texto.
  IF v_rua = '' OR v_cidade = '' OR v_uf = '' OR v_cep = '' THEN
    v_parse := public.f_parse_endereco_cotacao(COALESCE(p_parada ->> 'endereco', ''));
    IF v_rua = '' THEN v_rua := COALESCE(v_parse ->> 'logradouro', ''); END IF;
    IF v_numero = '' THEN v_numero := COALESCE(v_parse ->> 'numero', ''); END IF;
    IF v_bairro = '' THEN v_bairro := COALESCE(v_parse ->> 'bairro', ''); END IF;
    IF v_cidade = '' THEN v_cidade := COALESCE(v_parse ->> 'cidade', ''); END IF;
    IF v_uf = '' THEN v_uf := COALESCE(v_parse ->> 'uf', ''); END IF;
    IF v_cep = '' THEN v_cep := COALESCE(v_parse ->> 'cep', ''); END IF;
  END IF;

  v_ref := NULLIF(btrim(concat_ws(' · ',
    NULLIF(v_compl, ''),
    NULLIF(v_obs, '')
  ), ' ·'), '');

  -- Endereço completo legível: "Rua, Número, Bairro, Cidade - UF, CEP".
  v_end := NULLIF(btrim(concat_ws(', ',
    NULLIF(btrim(concat_ws(', ', NULLIF(v_rua, ''), NULLIF(v_numero, ''))), ''),
    NULLIF(v_bairro, ''),
    NULLIF(btrim(concat_ws(' - ', NULLIF(v_cidade, ''), NULLIF(v_uf, ''))), ''),
    NULLIF(v_cep, '')
  )), '');
  IF v_end IS NULL THEN
    v_end := COALESCE(p_parada ->> 'endereco', '');
  END IF;

  RETURN jsonb_build_object(
    'sequencia', p_seq,
    'tipo', p_tipo,
    'endereco', v_end,
    'logradouro', v_rua,
    'numero', v_numero,
    'complemento', v_compl,
    'cep', v_cep,
    'bairro', v_bairro,
    'cidade', v_cidade,
    'uf', v_uf,
    'estado', v_uf,
    'referencia', COALESCE(v_ref, ''),
    'instrucoes', COALESCE(v_ref, ''),
    'contato', v_contato,
    'contatoNome', v_contato,
    'contato_nome', v_contato,
    'responsavel', v_contato,
    'telefone', '',
    'janelaInicio', p_janela_inicio,
    'janela_inicio', p_janela_inicio,
    'janelaFim', p_janela_fim,
    'janela_fim', p_janela_fim,
    'janelaHorario', p_janela,
    'agendamento', p_agendamento,
    'statusPonto', 'pendente',
    'status_ponto', 'pendente',
    'observacoes', v_obs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_endereco_cotacao_os(jsonb, jsonb, text, text, text, boolean, int, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. f_cotacao_detalhes_para_os — fuso SP, cliente herdado, endereços e status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_cotacao_detalhes_para_os(p_cotacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cot              RECORD;
  v_cliente_id       uuid;
  v_cliente_nome     text;
  v_telefone         text;
  v_orcamento_id     uuid;
  v_orcamento_numero text;
  v_os_id            uuid;
  v_os_numero        text;
  v_enderecos        jsonb;
  v_carga            jsonb;
  v_valor            numeric;
  v_preco            jsonb;
  v_tipo_veiculo     text;
  v_rotulo           text;
  v_km               numeric;
  v_obs              text;
  v_hist_orc         jsonb;
  v_hist_os          jsonb;
  v_existente        RECORD;
  v_janela           text;
  v_janela_inicio    text;
  v_janela_fim       text;
  v_tem_agendamento  boolean;
BEGIN
  IF p_cotacao_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_INVALIDA',
      'message', 'Cotação não informada.'
    );
  END IF;

  -- Serializa chamadas concorrentes da mesma cotação (evita duplicidade).
  PERFORM pg_advisory_xact_lock(hashtext('cotacao_express_os:' || p_cotacao_id::text)::bigint);

  SELECT * INTO v_cot
  FROM public.cotacoes_publicas
  WHERE id = p_cotacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_NAO_ENCONTRADA',
      'message', 'Cotação não encontrada.'
    );
  END IF;

  -- ----------------------------------------------------------
  -- IDEMPOTÊNCIA — vínculo já gravado na cotação
  -- ----------------------------------------------------------
  IF v_cot.orcamento_id IS NOT NULL THEN
    SELECT o.id, o.numero, o.cliente_id, o.os_vinculada_id, o.os_vinculada_numero
      INTO v_existente
      FROM public.orcamentos o
     WHERE o.id = v_cot.orcamento_id;

    IF FOUND THEN
      IF v_existente.os_vinculada_id IS NULL THEN
        SELECT id, numero INTO v_os_id, v_os_numero
          FROM public.ordens_servico
         WHERE orcamento_id = v_existente.id
         ORDER BY created_at
         LIMIT 1;

        IF v_os_id IS NOT NULL THEN
          UPDATE public.orcamentos
             SET os_vinculada_id = v_os_id,
                 os_vinculada_numero = v_os_numero,
                 status = 'convertido',
                 updated_at = now()
           WHERE id = v_existente.id;
          v_existente.os_vinculada_id := v_os_id;
          v_existente.os_vinculada_numero := v_os_numero;
        END IF;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'created', false,
        'cotacao_id', v_cot.id,
        'cliente_id', v_existente.cliente_id,
        'orcamento_id', v_existente.id,
        'orcamento_numero', v_existente.numero,
        'os_id', v_existente.os_vinculada_id,
        'os_numero', v_existente.os_vinculada_numero
      );
    END IF;
  END IF;

  -- Fallback de idempotência: orçamento órfão com o mesmo pedido_interno.
  SELECT o.id, o.numero, o.cliente_id, o.os_vinculada_id, o.os_vinculada_numero
    INTO v_existente
    FROM public.orcamentos o
   WHERE o.pedido_interno = p_cotacao_id::text
   ORDER BY o.id
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.cotacoes_publicas
       SET orcamento_id = v_existente.id,
           updated_at = now()
     WHERE id = p_cotacao_id;

    IF v_existente.os_vinculada_id IS NULL THEN
      SELECT id, numero INTO v_os_id, v_os_numero
        FROM public.ordens_servico
       WHERE orcamento_id = v_existente.id
       ORDER BY created_at
       LIMIT 1;

      IF v_os_id IS NOT NULL THEN
        UPDATE public.orcamentos
           SET os_vinculada_id = v_os_id,
               os_vinculada_numero = v_os_numero,
               status = 'convertido',
               updated_at = now()
         WHERE id = v_existente.id;
        v_existente.os_vinculada_id := v_os_id;
        v_existente.os_vinculada_numero := v_os_numero;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'cotacao_id', p_cotacao_id,
      'cliente_id', v_existente.cliente_id,
      'orcamento_id', v_existente.id,
      'orcamento_numero', v_existente.numero,
      'os_id', v_existente.os_vinculada_id,
      'os_numero', v_existente.os_vinculada_numero
    );
  END IF;

  -- Só permite gerar OS depois que o cliente concluiu os endereços.
  IF v_cot.status <> 'Pronto para OS' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DETALHES_PENDENTES',
      'message', 'A cotação ainda não está pronta para gerar a OS.'
    );
  END IF;

  -- ----------------------------------------------------------
  -- DADOS BASE
  -- ----------------------------------------------------------
  v_cliente_nome := COALESCE(NULLIF(btrim(v_cot.nome_cliente), ''), 'Cliente Cotação Express');
  v_telefone     := NULLIF(btrim(COALESCE(v_cot.telefone, '')), '');
  v_preco        := COALESCE(v_cot.metadata -> 'precificacao', '{}'::jsonb);
  v_valor        := COALESCE(v_cot.valor_aprovado, NULLIF(v_preco ->> 'valor', '')::numeric, 0);
  v_tipo_veiculo := COALESCE(NULLIF(v_preco ->> 'tipo_veiculo', ''), '');
  v_rotulo       := COALESCE(NULLIF(v_preco ->> 'rotulo_veiculo', ''), '');
  v_km           := NULLIF(v_preco ->> 'distancia_km', '')::numeric;

  -- ----------------------------------------------------------
  -- JANELA DE HORÁRIO — "09:00 às 11:00" → início/fim
  -- ----------------------------------------------------------
  v_janela := btrim(COALESCE(v_cot.hora_desejada, ''));
  IF v_janela ~ '\d{1,2}:\d{2}' THEN
    v_janela_inicio := COALESCE((regexp_match(v_janela, '(\d{1,2}:\d{2})'))[1], '');
    v_janela_fim    := COALESCE((regexp_match(v_janela, '(\d{1,2}:\d{2})'))[2], '');
  ELSE
    v_janela_inicio := v_janela;
    v_janela_fim    := '';
  END IF;
  v_tem_agendamento := (v_cot.data_desejada IS NOT NULL) OR (v_janela <> '');

  -- ----------------------------------------------------------
  -- CLIENTE — herda EXATAMENTE o nome + telefone da cotação
  -- ----------------------------------------------------------
  SELECT id INTO v_cliente_id
    FROM public.clientes
   WHERE lower(btrim(COALESCE(nome_fantasia, ''))) = lower(v_cliente_nome)
      OR lower(btrim(COALESCE(razao_social, ''))) = lower(v_cliente_nome)
   ORDER BY id
   LIMIT 1;

  IF v_cliente_id IS NULL AND v_telefone IS NOT NULL THEN
    SELECT id INTO v_cliente_id
      FROM public.clientes
     WHERE regexp_replace(COALESCE(telefone, ''), '\D', '', 'g') = regexp_replace(v_telefone, '\D', '', 'g')
        OR regexp_replace(COALESCE(whatsapp, ''), '\D', '', 'g') = regexp_replace(v_telefone, '\D', '', 'g')
     ORDER BY id
     LIMIT 1;

    -- Casou por telefone com um cadastro de outro nome (ex.: conta
    -- administrativa): renomeia para o nome que o cliente digitou.
    IF v_cliente_id IS NOT NULL THEN
      UPDATE public.clientes
         SET nome_fantasia = v_cliente_nome,
             razao_social = v_cliente_nome,
             telefone = v_telefone,
             whatsapp = v_telefone,
             updated_at = now()
       WHERE id = v_cliente_id;
    END IF;
  END IF;

  -- Casou por nome: garante o telefone informado na cotação.
  IF v_cliente_id IS NOT NULL AND v_telefone IS NOT NULL THEN
    UPDATE public.clientes
       SET telefone = v_telefone,
           whatsapp = v_telefone,
           updated_at = now()
     WHERE id = v_cliente_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_id := gen_random_uuid();

    INSERT INTO public.clientes (
      id, nome_fantasia, razao_social, telefone, whatsapp,
      status, origem_comercial, tenant_id
    ) VALUES (
      v_cliente_id,
      v_cliente_nome,
      v_cliente_nome,
      v_telefone,
      v_telefone,
      'pre-cadastro',
      'Cotação Express',
      COALESCE(public.current_tenant_id_safe(), '00000000-0000-0000-0000-000000000001'::uuid)
    );
  END IF;

  -- ----------------------------------------------------------
  -- ENDEREÇOS — desmembrados (Fase 1 estruturada + Fase 2 detalhe)
  -- ----------------------------------------------------------
  SELECT COALESCE(
    jsonb_agg(
      public.f_endereco_cotacao_os(
        p,
        COALESCE(det.d, '{}'::jsonb),
        v_janela_inicio,
        v_janela_fim,
        v_janela,
        v_tem_agendamento,
        COALESCE(NULLIF(p ->> 'sequencia', '')::int, ord::int),
        CASE WHEN ord = 1 THEN 'coleta' ELSE 'entrega' END
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  INTO v_enderecos
  FROM jsonb_array_elements(COALESCE(v_cot.paradas, '[]'::jsonb)) WITH ORDINALITY AS t(p, ord)
  LEFT JOIN LATERAL (
    SELECT dd AS d
      FROM jsonb_array_elements(COALESCE(v_cot.detalhes, '[]'::jsonb)) WITH ORDINALITY AS dt(dd, dord)
     WHERE COALESCE(NULLIF(dd ->> 'sequencia', '')::int, dord::int)
           = COALESCE(NULLIF(p ->> 'sequencia', '')::int, ord::int)
     LIMIT 1
  ) det ON true;

  -- ----------------------------------------------------------
  -- CARGA / OBSERVAÇÕES
  -- ----------------------------------------------------------
  v_carga := jsonb_build_object(
    'tipo', 'Seca',
    'descricao', COALESCE(v_cot.carga_descricao, ''),
    'volumes', COALESCE(v_cot.carga_volumes, 0),
    'peso', COALESCE(v_cot.carga_peso, 0),
    'cubagem', 0,
    'pallets', 0,
    'valorDeclarado', 0,
    'qtdNotas', 0,
    'refrigerada', false,
    'ajudante', false,
    'fragil', false,
    'empilhavel', true,
    'risco', false,
    'perigosa', false,
    'controlada', false,
    'conferencia', false,
    'equipamento', '',
    'condicao', '',
    'comprimento', 0,
    'largura', 0,
    'altura', 0,
    'pesoPorVolume', 0,
    'temperaturaMinima', 0,
    'temperaturaMaxima', 0,
    'observacoesCarga', COALESCE(v_cot.carga_dimensoes, ''),
    'data_desejada', COALESCE(to_char(v_cot.data_desejada, 'YYYY-MM-DD'), ''),
    'hora_desejada', COALESCE(v_cot.hora_desejada, ''),
    'janela_inicio', v_janela_inicio,
    'janela_fim', v_janela_fim,
    'janela_horario', v_janela,
    'agendado', v_tem_agendamento,
    'origem_cotacao', v_cot.id::text
  );

  v_obs := concat_ws(' · ',
    'Cotação web (Fase 2) — cliente ' || v_cliente_nome,
    CASE WHEN v_telefone IS NOT NULL THEN 'WhatsApp: ' || v_telefone END,
    CASE WHEN v_valor > 0 THEN 'Valor aprovado: R$ ' || replace(to_char(v_valor, 'FM999999990D00'), '.', ',') END,
    CASE WHEN v_km IS NOT NULL THEN 'Distância estimada: ' || v_km || ' km' END,
    CASE WHEN v_rotulo <> '' THEN 'Veículo sugerido: ' || v_rotulo END,
    CASE WHEN v_cot.data_desejada IS NOT NULL THEN 'Data desejada: ' || to_char(v_cot.data_desejada, 'DD/MM/YYYY') END,
    CASE WHEN v_janela <> '' THEN 'Horário: ' || v_janela END,
    'ID da cotação: ' || v_cot.id::text
  );

  v_hist_orc := jsonb_build_array(
    jsonb_build_object(
      'data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS'),
      'acao', 'Orçamento criado automaticamente pela Cotação Express (Fase 2)',
      'usuario', 'Site /cotacao-express'
    )
  );

  -- Histórico da OS já no fuso local (timestamp sem time zone).
  v_hist_os := jsonb_build_array(
    jsonb_build_object(
      'data', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'acao', 'OS criada automaticamente pela Cotação Express (Fase 2)',
      'status_novo', 'em_analise',
      'usuario', 'Sistema'
    )
  );

  -- ----------------------------------------------------------
  -- NÚMERO DO ORÇAMENTO (ORC-AAAAMM-XXXX, único)
  -- ----------------------------------------------------------
  LOOP
    v_orcamento_numero := 'ORC-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orcamentos WHERE numero = v_orcamento_numero
    );
  END LOOP;

  INSERT INTO public.orcamentos (
    numero, cliente, cliente_id, unidade, data_emissao, validade,
    tipo_operacao, modalidade, prioridade, pedido_interno,
    observacoes_gerais, status,
    carga_descricao, carga_volumes, carga_peso, carga_cubagem,
    carga_pallets, carga_valor_declarado, carga_refrigerado, carga_ajudante,
    carga_fragil, carga_tipo, carga_refrigerada, carga_empilhavel,
    carga_risco, carga_perigosa, carga_controlada, veiculo_termica,
    veiculo_tipo,
    valor_base, pedagio, adicionais, descontos, valor_final, custo_estimado,
    historico, enderecos, carga, veiculo, valores,
    created_at, updated_at
  ) VALUES (
    v_orcamento_numero, v_cliente_nome, v_cliente_id, 'São Paulo - Matriz',
    (now() AT TIME ZONE 'America/Sao_Paulo')::date, NULL, 'Coleta e Entrega', 'esporadico', 'normal',
    p_cotacao_id::text, v_obs, 'em_analise',
    COALESCE(v_cot.carga_descricao, ''), COALESCE(v_cot.carga_volumes, 0),
    COALESCE(v_cot.carga_peso, 0), 0, 0, 0, false, false,
    false, 'Seca', false, true, false, false, false, 'seco',
    v_tipo_veiculo,
    v_valor, 0, 0, 0, v_valor, 0,
    v_hist_orc, v_enderecos, v_carga,
    jsonb_build_object('tipo', v_tipo_veiculo, 'subcategoria', v_rotulo, 'carroceria', ''),
    jsonb_build_object(
      'tabelaVinculada', COALESCE(v_preco ->> 'tabela', ''),
      'valorBase', v_valor,
      'adicionais', 0,
      'pedagio', 0,
      'kmExcedente', COALESCE((v_preco -> 'formula' ->> 'kmExcedente')::numeric, 0),
      'ajudante', 0,
      'devolucao', 0,
      'reentrega', 0,
      'descontos', 0,
      'valorFinal', v_valor,
      'custoEstimado', 0,
      'margemEstimada', 0,
      'lucroEstimado', 0
    ),
    now(), now()
  )
  RETURNING id INTO v_orcamento_id;

  -- ----------------------------------------------------------
  -- NÚMERO DA OS (OS-AAAAMM-NNNN, sequência oficial)
  -- ----------------------------------------------------------
  v_os_numero := public.f_proximo_numero_os();

  INSERT INTO public.ordens_servico (
    numero, data, cliente, cliente_id, unidade, status,
    tipo_operacao, modalidade, prioridade,
    carga_descricao, peso, volumes, valor_declarado, tipo_carga,
    observacoes_gerais, origem, destino,
    carga, enderecos, historico,
    valor_cliente, custo_prestador,
    tipo_veiculo, veiculo_subcategoria, veiculo_carroceria, veiculo_termica,
    orcamento_id, orcamento_origem,
    status_faturamento, status_pagamento,
    created_at, updated_at
  ) VALUES (
    v_os_numero, (now() AT TIME ZONE 'America/Sao_Paulo')::date, v_cliente_id, v_cliente_id::text,
    'São Paulo - Matriz', 'em_analise',
    'Coleta e Entrega', 'esporadico', 'normal',
    COALESCE(v_cot.carga_descricao, ''), COALESCE(v_cot.carga_peso, 0),
    COALESCE(v_cot.carga_volumes, 0), 0, 'Seca',
    v_obs,
    COALESCE(v_enderecos -> 0 ->> 'endereco', ''),
    COALESCE(v_enderecos -> (jsonb_array_length(v_enderecos) - 1) ->> 'endereco', ''),
    v_carga, v_enderecos, v_hist_os,
    v_valor, 0,
    v_tipo_veiculo, v_rotulo, '', 'seco',
    v_orcamento_id, v_orcamento_numero,
    'a faturar', 'a pagar',
    (now() AT TIME ZONE 'America/Sao_Paulo'),
    (now() AT TIME ZONE 'America/Sao_Paulo')
  )
  RETURNING id INTO v_os_id;

  UPDATE public.orcamentos
     SET status = 'convertido',
         os_vinculada_id = v_os_id,
         os_vinculada_numero = v_os_numero,
         updated_at = now()
   WHERE id = v_orcamento_id;

  UPDATE public.cotacoes_publicas
     SET orcamento_id = v_orcamento_id,
         status = 'Pronto para OS',
         updated_at = now()
   WHERE id = p_cotacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'cotacao_id', p_cotacao_id,
    'cliente_id', v_cliente_id,
    'orcamento_id', v_orcamento_id,
    'orcamento_numero', v_orcamento_numero,
    'os_id', v_os_id,
    'os_numero', v_os_numero,
    'janela_inicio', v_janela_inicio,
    'janela_fim', v_janela_fim
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[f_cotacao_detalhes_para_os] %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'ERRO_CONVERSAO',
    'message', 'Não foi possível abrir a OS agora. Tente novamente em instantes.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f_cotacao_detalhes_para_os(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_cotacao_detalhes_para_os(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. f_cotacao_status_cliente — 'aguardando' mantém a OS em 'em_analise'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_cotacao_status_cliente(
  p_cotacao_id uuid,
  p_acao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cot        public.cotacoes_publicas%ROWTYPE;
  v_acao       text;
  v_orc_id     uuid;
  v_os_id      uuid;
  v_os_status  text;
  v_now_text   text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS');
BEGIN
  v_acao := lower(btrim(COALESCE(p_acao, '')));

  IF v_acao NOT IN ('aguardando', 'cancelada') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACAO_INVALIDA',
      'message', 'Ação inválida.'
    );
  END IF;

  IF p_cotacao_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_INVALIDA',
      'message', 'Cotação não informada.'
    );
  END IF;

  SELECT * INTO v_cot FROM public.cotacoes_publicas WHERE id = p_cotacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'COTACAO_NAO_ENCONTRADA',
      'message', 'Cotação não encontrada.'
    );
  END IF;

  -- Orçamento/OS vinculados (a cotação pode ainda não ter OS gerada).
  v_orc_id := v_cot.orcamento_id;
  IF v_orc_id IS NULL THEN
    SELECT o.id
      INTO v_orc_id
      FROM public.orcamentos o
     WHERE o.pedido_interno = v_cot.id::text
     ORDER BY o.created_at
     LIMIT 1;
  END IF;

  IF v_orc_id IS NOT NULL THEN
    SELECT os.id, os.status
      INTO v_os_id, v_os_status
      FROM public.ordens_servico os
     WHERE os.orcamento_id = v_orc_id
     ORDER BY os.created_at
     LIMIT 1;

    IF v_os_id IS NULL THEN
      SELECT o.os_vinculada_id
        INTO v_os_id
        FROM public.orcamentos o
       WHERE o.id = v_orc_id;

      IF v_os_id IS NOT NULL THEN
        SELECT os.status INTO v_os_status
          FROM public.ordens_servico os
         WHERE os.id = v_os_id;
      END IF;
    END IF;
  END IF;

  -- ----------------------------------------------------------
  -- 'aguardando' — cliente chegou na tela final e ainda NÃO
  -- confirmou no WhatsApp → OS permanece 'em_analise'.
  -- ----------------------------------------------------------
  IF v_acao = 'aguardando' THEN
    IF v_os_id IS NOT NULL
       AND COALESCE(v_os_status, '') IN ('rascunho', 'em_analise', 'pendente')
    THEN
      UPDATE public.ordens_servico
         SET status = 'em_analise',
             historico = COALESCE(historico, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object(
                 'tipo', 'status',
                 'status_anterior', v_os_status,
                 'status_novo', 'em_analise',
                 'descricao', 'Aguardando confirmação do cliente via WhatsApp',
                 'data', v_now_text
               )
             ),
             observacoes_gerais = CASE
               WHEN COALESCE(observacoes_gerais, '') ILIKE '%aguardando confirma%'
                 THEN observacoes_gerais
               ELSE btrim(
                 COALESCE(observacoes_gerais, '') ||
                 ' | Aguardando confirmação do cliente via WhatsApp'
               )
             END,
             updated_at = now()
       WHERE id = v_os_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'acao', 'aguardando',
      'cotacao_id', p_cotacao_id,
      'os_id', v_os_id,
      'os_status', 'em_analise'
    );
  END IF;

  -- ----------------------------------------------------------
  -- 'cancelada' — cliente clicou em "Cancelar / Não preciso mais".
  -- ----------------------------------------------------------
  UPDATE public.cotacoes_publicas
     SET status = 'Cancelada pelo Cliente',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelado_pelo_cliente', true,
           'cancelado_em', v_now_text
         ),
         updated_at = now()
   WHERE id = p_cotacao_id;

  IF v_os_id IS NOT NULL
     AND COALESCE(v_os_status, '') IN ('rascunho', 'em_analise', 'pendente', 'agendada')
  THEN
    UPDATE public.ordens_servico
       SET status = 'cancelada',
           historico = COALESCE(historico, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object(
               'tipo', 'cancelamento',
               'status_anterior', v_os_status,
               'status_novo', 'cancelada',
               'descricao', 'Cancelada pelo Cliente (não confirmou via WhatsApp)',
               'data', v_now_text
             )
           ),
           observacoes_gerais = CASE
             WHEN COALESCE(observacoes_gerais, '') ILIKE '%cancelada pelo cliente%'
               THEN observacoes_gerais
             ELSE btrim(
               COALESCE(observacoes_gerais, '') ||
               ' | Cancelada pelo Cliente (não confirmou via WhatsApp)'
             )
           END,
           updated_at = now()
     WHERE id = v_os_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'acao', 'cancelada',
    'cotacao_id', p_cotacao_id,
    'status', 'Cancelada pelo Cliente',
    'os_id', v_os_id,
    'os_status_anterior', v_os_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_cotacao_status_cliente(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_cotacao_status_cliente(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
