const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`✅ ${label}`);
  } catch(err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`⏭️ ${label}`);
      return;
    }
    console.log(`❌ ${label}: ${err.message.substring(0, 150)}`);
  }
}

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check clientes columns
  console.log('=== DIAGNOSE: clientes columns ===');
  const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='clientes' ORDER BY ordinal_position`);
  console.log(cols.rows.map(c => c.column_name).join(', '));

  // Check prestadores columns
  const prestCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='prestadores' ORDER BY ordinal_position LIMIT 15`);
  console.log('prestadores:', prestCols.rows.map(c => c.column_name).join(', '));

  // Check if prestadores has tenant_id
  const tenantRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='prestadores' AND column_name='tenant_id'`);
  console.log(`tenant_id: ${tenantRes.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);

  // Drop old function to resolve uniqueness issue
  console.log('\n=== FIX: Drop old f_aceitar_oportunidade_rede ===');
  await run(client, 'Drop old function', `DROP FUNCTION IF EXISTS public.f_aceitar_oportunidade_rede(p_oportunidade_id UUID, p_prestador_id UUID)`);

  // Now recreate with correct signature (will replace the 3-param version)
  console.log('\n=== FIX: Recreate f_aceitar_oportunidade_rede ===');
  await run(client, 'f_aceitar_oportunidade_rede', `
CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_uuid UUID,
  p_auth_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_tipo_operacao TEXT;
  v_tipo_reversa TEXT;
  v_operation_mode TEXT;
  v_rota_id UUID;
BEGIN
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de autenticação inválido');
    END IF;
  END IF;
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r WHERE r.id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;
  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;
  SELECT status INTO v_prestador_status FROM public.prestadores WHERE id = p_prestador_uuid;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;
  SELECT * INTO v_os_record FROM public.ordens_servico WHERE id = v_os_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS vinculada não encontrada');
  END IF;
  IF v_os_record.status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;
  v_os_status := v_os_record.status;
  v_tipo_operacao := COALESCE(v_os_record.tipo_operacao, '');
  v_tipo_reversa := COALESCE(v_os_record.tipo_reversa, 'sem_reversa');
  IF v_tipo_operacao ILIKE '%multiparada%' OR v_tipo_operacao ILIKE '%e-commerce%' OR v_tipo_operacao ILIKE '%distribuição%' OR v_tipo_operacao ILIKE '%distribuicao%' THEN
    v_operation_mode := 'multi_stop_route';
  ELSIF v_tipo_reversa != 'sem_reversa' THEN
    v_operation_mode := 'reverse_logistics';
  ELSE
    v_operation_mode := 'standard_delivery';
  END IF;
  UPDATE public.rede_oportunidades SET status = 'aceita', prestador_aceite_id = p_prestador_uuid, aceite_em = NOW()
  WHERE id = p_oportunidade_id;
  UPDATE public.ordens_servico SET prestador_id = p_prestador_uuid::TEXT, prestador = p_prestador_uuid,
    status = CASE WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada' ELSE v_os_status END
  WHERE id = v_os_id;
  INSERT INTO public.alocacoes_escala (ordem_servico_id, prestador_id, cliente_id, status, data_escala, tipo_veiculo, placa, origem, destino, valor_frete, valor_repasse, km_previstos, aceite_prestador, data_aceite, tipo_reversa, observacoes, metadata)
  VALUES (v_os_id, p_prestador_uuid, v_os_record.cliente_id, 'aceita', COALESCE(v_os_record.data_programada, CURRENT_DATE),
    COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''), v_os_record.placa_alocada,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1 THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade' ELSE v_os_record.destino END,
    COALESCE(v_os_record.valor_cliente, 0), COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    v_os_record.distancia_km, true, NOW(), v_tipo_reversa, v_os_record.observacoes_gerais,
    jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id, 'origem', 'rede_prestadores', 'operation_mode', v_operation_mode, 'tipo_operacao', v_tipo_operacao))
  ON CONFLICT (ordem_servico_id) DO UPDATE SET prestador_id = p_prestador_uuid, status = 'aceita',
    valor_frete = COALESCE(v_os_record.valor_cliente, 0), valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    aceite_prestador = true, data_aceite = NOW(),
    tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
    metadata = alocacoes_escala.metadata || jsonb_build_object('aceite_tipo', 'rede_enterprise', 'operation_mode', v_operation_mode)
  RETURNING id INTO v_alocacao_id;
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    INSERT INTO public.rotas (os_id, cliente_id, data_rota, status, origem, distancia_km, duracao_min, peso_total, volumes_total, prestador_id, tipo_rota, metadata)
    VALUES (v_os_id, v_os_record.cliente_id, COALESCE(v_os_record.data_programada, CURRENT_DATE), 'em_andamento',
      CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
      v_os_record.distancia_km, v_os_record.tempo_minutos, v_os_record.peso, v_os_record.volumes, p_prestador_uuid,
      CASE WHEN v_tipo_operacao ILIKE '%refrigerado%' THEN 'refrigerada' ELSE 'seca' END,
      jsonb_build_object('operation_mode', v_operation_mode, 'alocacao_id', v_alocacao_id, 'tipo_operacao', v_tipo_operacao))
    ON CONFLICT (os_id) DO UPDATE SET prestador_id = p_prestador_uuid, status = 'em_andamento'
    RETURNING id INTO v_rota_id;
    INSERT INTO public.rota_paradas (rota_id, sequencia, cliente_nome, endereco, numero, bairro, cidade, uf, cep, latitude, longitude, peso, volumes, cubagem, temperatura, observacoes, status)
    SELECT v_rota_id, seq,
      COALESCE(e->>'nome_destinatario', e->>'nome', ''), COALESCE(e->>'logradouro', e->>'endereco', ''),
      COALESCE(e->>'numero', ''), COALESCE(e->>'bairro', ''), COALESCE(e->>'cidade', ''), COALESCE(e->>'uf', ''),
      COALESCE(e->>'cep', ''), COALESCE((e->>'latitude')::numeric, NULL), COALESCE((e->>'longitude')::numeric, NULL),
      v_os_record.peso / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      GREATEST(CEIL(COALESCE(v_os_record.volumes, 0) / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1)), 1),
      v_os_record.cubagem / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      CASE WHEN v_os_record.carga_refrigerada THEN 'refrigerada' ELSE 'seca' END,
      COALESCE(e->>'instrucoes', e->>'observacoes', ''), 'pendente'
    FROM jsonb_array_elements(v_os_record.enderecos::jsonb) WITH ORDINALITY AS e(elem, seq)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.portal_notificacoes (prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at)
  VALUES (p_prestador_uuid, 'Nova operação disponível',
    format('Você aceitou a oportunidade #%s. Operação: %s.', UPPER(SUBSTRING(v_os_id::TEXT, 1, 8)), v_operation_mode),
    'oportunidade_aceita', v_os_id, 'rede_oportunidades', false, NOW());
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, format('Prestador aceitou via Rede [mode=%s]', v_operation_mode), 'agendada',
          CASE WHEN p_auth_user_id IS NOT NULL THEN p_auth_user_id::TEXT ELSE 'Sistema Rede' END);
  DELETE FROM public.rede_visualizacoes WHERE oportunidade_id = p_oportunidade_id AND prestador_id != p_prestador_uuid;
  RETURN jsonb_build_object('sucesso', true, 'os_id', v_os_id, 'alocacao_id', v_alocacao_id, 'rota_id', v_rota_id, 'prestador_id', p_prestador_uuid, 'operation_mode', v_operation_mode,
    'mensagem', format('Oportunidade aceita. Modo: %s. Alocação criada.', v_operation_mode));
END;
$$`);
  
  // Recreate views with correct column names
  console.log('\n=== FIX: Views ===');
  
  await run(client, 'vw_app_motorista_operacoes', `
CREATE OR REPLACE VIEW public.vw_app_motorista_operacoes AS
SELECT
  a.id AS alocacao_id,
  a.ordem_servico_id AS os_id,
  a.prestador_id AS motorista_id,
  a.cliente_id,
  a.status,
  a.data_escala,
  a.tipo_veiculo,
  a.placa,
  a.origem,
  a.destino,
  a.valor_frete,
  a.valor_repasse,
  a.km_previstos,
  a.km_realizados,
  a.aceite_prestador,
  a.data_aceite,
  a.horario_inicio_real,
  a.horario_fim_real,
  a.tempo_total_minutos,
  a.tipo_reversa,
  a.reversa_status,
  a.reversa_qtd_volumes,
  a.reversa_valor_cliente,
  a.reversa_valor_prestador,
  a.reversa_observacoes,
  a.observacoes,
  a.instrucoes_operacionais,
  COALESCE(a.metadata->>'operation_mode',
    CASE WHEN a.tipo_reversa != 'sem_reversa' THEN 'reverse_logistics' ELSE 'standard_delivery' END
  ) AS operation_mode,
  a.metadata,
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.telefone AS cliente_telefone,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,
  os.numero AS os_numero,
  os.tipo_operacao,
  os.peso, os.volumes, os.cubagem,
  os.carga_tipo, os.carga_refrigerada, os.tipo_carga, os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,
  r.id AS rota_id, r.nome AS rota_nome, r.status AS rota_status,
  r.distancia_km AS rota_distancia_km, r.numero_paradas, r.paradas_pendentes,
  r.operation_mode AS rota_operation_mode,
  tr.latitude, tr.longitude, tr.velocidade, tr.ultima_atualizacao
FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, updated_at AS ultima_atualizacao
  FROM public.portal_tracking_realtime WHERE alocacao_id = a.id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL`);

  await run(client, 'vw_app_motorista_paradas', `
CREATE OR REPLACE VIEW public.vw_app_motorista_paradas AS
SELECT
  rp.id AS parada_id, rp.rota_id, rp.sequencia,
  rp.cliente_nome AS destinatario, rp.endereco, rp.numero, rp.bairro,
  rp.cidade, rp.uf, rp.cep, rp.latitude, rp.longitude,
  rp.peso, rp.volumes, rp.cubagem,
  rp.temperatura AS tipo_carga, rp.prioridade, rp.janela_entrega,
  rp.instrucoes, rp.status, rp.recebedor, rp.assinatura_url,
  rp.pod_url, rp.fotos, rp.ocorrencia, rp.data_hora,
  rp.latitude_fim, rp.longitude_fim, rp.data_entrega,
  rp.volumes_entregues, rp.observacoes, rp.os_id, rp.alocacao_id,
  rp.pedido, rp.nota_fiscal, rp.contato, rp.tipo_carga
FROM public.rota_paradas rp
ORDER BY rp.sequencia`);

  // Fix notificacao policy
  console.log('\n=== FIX: Notificação policy ===');
  await run(client, 'Drop old policy', `DROP POLICY IF EXISTS "notificacoes_select_anon" ON public.portal_notificacoes`);
  await run(client, 'Create fixed policy', `CREATE POLICY "notificacoes_select_anon" ON public.portal_notificacoes
    FOR SELECT TO anon USING (prestador_id IS NOT NULL)`);

  // Grant on views
  console.log('\n=== FIX: Grants ===');
  await run(client, 'GRANT views', `GRANT SELECT ON public.vw_app_motorista_operacoes TO anon, authenticated`);
  await run(client, 'GRANT views 2', `GRANT SELECT ON public.vw_app_motorista_paradas TO anon, authenticated`);
  await run(client, 'GRANT views 3', `GRANT SELECT ON public.vw_app_notificacoes_pendentes TO anon, authenticated`);

  await run(client, 'GRANT EXEC f_aceitar', `GRANT EXECUTE ON FUNCTION public.f_aceitar_oportunidade_rede TO anon, authenticated`);

  // Final verification
  console.log('\n=== FINAL VERIFICATION ===');
  const checks = [
    `SELECT 'os_historico.acao' q FROM information_schema.columns WHERE table_name='os_historico' AND column_name='acao'`,
    `SELECT 'rotas.operation_mode' q FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT 'rota_paradas.fotos' q FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='fotos'`,
    `SELECT 'notificacoes.prestador_id' q FROM information_schema.columns WHERE table_name='portal_notificacoes' AND column_name='prestador_id'`,
    `SELECT 'f_aceitar_oportunidade_rede' q FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede' AND pronargs=3`,
    `SELECT 'f_calcular_financeiro_operacao' q FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT 'f_buscar_operacoes_motorista' q FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT 'f_atualizar_status_parada' q FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT 'vw_app_motorista_operacoes' q FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT 'vw_app_motorista_paradas' q FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT 'vw_app_notificacoes_pendentes' q FROM pg_views WHERE viewname='vw_app_notificacoes_pendentes'`,
    `SELECT 'trg_notificar_os_para_app' q FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT 'pol rotas_select_anon_suas' q FROM pg_policies WHERE policyname='rotas_select_anon_suas'`,
    `SELECT 'idx_rotas_operation_mode' q FROM pg_indexes WHERE indexname='idx_rotas_operation_mode'`,
    `SELECT 'GRANT EXEC f_aceitar' q FROM information_schema.routine_privileges WHERE routine_name='f_aceitar_oportunidade_rede' AND privilege_type='EXECUTE'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      console.log(`${r.rows.length > 0 ? '✅' : '❌'} ${r.rows[0]?.q || '?'}`);
    } catch(e) {
      console.log(`❌ ${check.match(/'([^']+)'/)?.[1]}: ${e.message.substring(0, 60)}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
