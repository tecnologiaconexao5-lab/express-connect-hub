-- ============================================================
-- SEED DE TESTE PARA RELATORIOS E ESCALA
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Criar cliente DVL DISTRIBUIDORA se nao existir
DO $$
DECLARE
  v_cliente_id UUID;
  v_prestador_id UUID;
  v_os_id UUID;
  v_hoje DATE := CURRENT_DATE;
BEGIN
  SELECT id INTO v_cliente_id FROM public.clientes
    WHERE nome_fantasia ILIKE '%DVL%' OR razao_social ILIKE '%DVL%'
    LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (razao_social, nome_fantasia, cnpj, status, cidade, uf, telefone, email)
    VALUES ('DVL DISTRIBUIDORA LTDA', 'DVL DISTRIBUIDORA', '12.345.678/0001-90', 'Ativo', 'Sao Paulo', 'SP', '(11) 4000-1234', 'financeiro@dvl.com.br')
    RETURNING id INTO v_cliente_id;
    RAISE NOTICE '[SEED] Cliente DVL criado: %', v_cliente_id;
  ELSE
    RAISE NOTICE '[SEED] Cliente DVL ja existe: %', v_cliente_id;
  END IF;

  -- 2. Criar prestador FRANKLIN DA SILVA PEREIRA se nao existir
  SELECT id INTO v_prestador_id FROM public.prestadores
    WHERE nome_completo ILIKE '%FRANKLIN%'
    LIMIT 1;

  IF v_prestador_id IS NULL THEN
    INSERT INTO public.prestadores (nome_completo, nome_fantasia, cpf_cnpj, tipo_parceiro, status, telefone, score_interno, cidade, uf)
    VALUES ('FRANKLIN DA SILVA PEREIRA', 'TRANSPORTES FRANKLIN', '111.222.333-44', 'autonomo', 'ativo', '(11) 98765-4321', 4.5, 'Sao Paulo', 'SP')
    RETURNING id INTO v_prestador_id;
    RAISE NOTICE '[SEED] Prestador FRANKLIN criado: %', v_prestador_id;
  ELSE
    RAISE NOTICE '[SEED] Prestador FRANKLIN ja existe: %', v_prestador_id;
  END IF;

  -- 3. Criar OS de teste
  INSERT INTO public.ordens_servico (numero, data, cliente, prestador, status, tipo_operacao,
    valor_cliente, custo_prestador, pedagio, adicionais, descontos,
    veiculo_tipo, veiculo_placa, km_total,
    enderecos, created_at)
  VALUES (
    'OS-TEST-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS'),
    v_hoje,
    'DVL DISTRIBUIDORA',
    'FRANKLIN DA SILVA PEREIRA',
    'finalizada',
    'Transferencia',
    600.00,
    450.00,
    0, 0, 0,
    'VUC', 'TST-1A23',
    150,
    '[
      {"tipo":"coleta","cidade":"Sao Paulo","estado":"SP","endereco":"Av. Paulista, 1000","nomeLocal":"DVL CD Sao Paulo"},
      {"tipo":"entrega","cidade":"Guarulhos","estado":"SP","endereco":"Rua Teste, 500","nomeLocal":"Filial Guarulhos"}
    ]'::jsonb,
    NOW()
  )
  RETURNING id INTO v_os_id;

  RAISE NOTICE '[SEED] OS criada: %', v_os_id;

  -- 4. Criar alocacao_escala vinculada
  INSERT INTO public.alocacoes_escala (data_escala, prestador_id, cliente_id, ordem_servico_id,
    tipo_veiculo, placa, status, status_pagamento,
    valor_frete, valor_repasse, km_previstos, turno, created_at)
  VALUES (
    v_hoje,
    v_prestador_id,
    v_cliente_id,
    v_os_id,
    'VUC', 'TST-1A23',
    'concluida', 'pendente',
    600.00, 450.00, 150, 'diurno', NOW()
  );

  RAISE NOTICE '[SEED] Alocacao escala criada';

  -- 5. Criar financeiro_receber vinculado
  INSERT INTO public.financeiro_receber (os_id, cliente, descricao, valor, vencimento, data_emissao, status, created_at)
  VALUES (
    v_os_id,
    'DVL DISTRIBUIDORA',
    'Faturamento OS-TEST',
    600.00,
    v_hoje + INTERVAL '30 days',
    v_hoje,
    'aberto',
    NOW()
  );

  RAISE NOTICE '[SEED] financeiro_receber criado';

  -- 6. Criar pagamentos_prestadores vinculado
  INSERT INTO public.pagamentos_prestadores (prestador_id, prestador_nome, periodo_inicio, periodo_fim,
    quantidade_os, valor_servicos, valor_liquido, status, created_at)
  VALUES (
    v_prestador_id,
    'FRANKLIN DA SILVA PEREIRA',
    v_hoje,
    v_hoje,
    1, 450.00, 450.00, 'pendente', NOW()
  );

  RAISE NOTICE '[SEED] pagamentos_prestadores criado';

  RAISE NOTICE '[SEED] ========================================';
  RAISE NOTICE '[SEED] MASSA DE TESTE CRIADA COM SUCESSO!';
  RAISE NOTICE '[SEED] Cliente DVL: %', v_cliente_id;
  RAISE NOTICE '[SEED] Prestador FRANKLIN: %', v_prestador_id;
  RAISE NOTICE '[SEED] OS: %', v_os_id;
  RAISE NOTICE '[SEED] Valor Cliente: R$ 600,00';
  RAISE NOTICE '[SEED] Valor Prestador: R$ 450,00';
  RAISE NOTICE '[SEED] Margem: R$ 150,00';
  RAISE NOTICE '[SEED] ========================================';
END $$;
