-- =====================================================
-- MISSÃO 136-A — CLIENTE DE HOMOLOGAÇÃO
-- =====================================================
-- CNPJ gerado: 11.222.333/0001-81
-- (fictício, matematicamente válido, reservado a teste)
-- =====================================================

DO $$
DECLARE
  v_cliente_id UUID := gen_random_uuid();
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  -- Obter tenant e usuário
  SELECT tenant_id INTO v_tenant_id FROM tenant_usuarios
  WHERE user_id = auth.uid() AND status = 'ativo' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  INSERT INTO clientes (
    id, razao_social, nome_fantasia, cnpj, ie,
    segmento, porte, status,
    contato_principal, telefone, whatsapp, email, site,
    cidade, uf,
    responsavel_operacional, responsavel_financeiro, responsavel_comercial,
    observacoes, origem_comercial,
    exige_agendamento, exige_sla, exige_portal, aceita_api,
    cep, logradouro, numero, bairro, complemento,
    tipo_cobranca, vencimento_padrao, agrupamento_faturamento,
    cte_obrigatorio, comprovante_obrigatorio,
    tomador, cnae, cfop_padrao, regime_tributario, aliquota_iss, municipio_padrao,
    tenant_id, created_at, updated_at
  ) VALUES (
    v_cliente_id,
    'CLIENTE HOMOLOGACAO TMS 136A LTDA',
    'CLIENTE HML 136A',
    '11222333000181',
    '123.456.789.101',
    'Varejo',
    'Medio',
    'ativo',
    'Joao Silva',
    '(11) 99999-0001',
    '(11) 98888-0001',
    'homologacao136a@teste.tms',
    'https://homologacao.tms',
    'Guarulhos',
    'SP',
    'Maria Souza (Resp. Operacional)',
    'Carlos Santos (Resp. Financeiro)',
    'Ana Costa (Resp. Comercial)',
    'Cliente criado exclusivamente para homologacao da Missao 136-A',
    'Homologacao interna',
    true, true, true, false,
    '07000-001',
    'Avenida Teste de Homologacao',
    '1000',
    'Jardim Validacao',
    'Sala 42 - Bloco A',
    'por_os',
    15,
    'por_periodo',
    true, true,
    'proprio',
    '4930-2/01',
    '5351',
    'lucro_presumido',
    2.5,
    '3550308 - Sao Paulo',
    v_tenant_id,
    NOW(), NOW()
  );

  -- Endereço
  INSERT INTO enderecos_clientes (cliente_id, tipo_endereco, cep, logradouro, numero, bairro, cidade, uf)
  VALUES (v_cliente_id, 'Matriz', '07000-001', 'Avenida Teste de Homologacao', '1000', 'Jardim Validacao', 'Guarulhos', 'SP');

  -- Contrato
  INSERT INTO clientes_contratos (cliente_id, numero, tipo, objeto, valor, vigencia_inicio, vigencia_fim, status)
  VALUES (v_cliente_id, 'CT-136A-001', 'Servicos', 'Contrato de homologacao Missao 136-A', 15000.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months', 'ativo');

  RAISE NOTICE 'Cliente de homologacao criado: %', v_cliente_id;
END;
$$;
