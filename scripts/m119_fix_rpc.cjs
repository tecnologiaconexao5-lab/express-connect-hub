const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('Fixing RPC eventos_oficiais column names...');
  
  await client.query(`
    CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(
      p_alocacao_id UUID,
      p_reversa_status TEXT DEFAULT NULL,
      p_reversa_qtd_coletada INTEGER DEFAULT NULL,
      p_reversa_motivo_divergencia TEXT DEFAULT NULL,
      p_reversa_responsavel TEXT DEFAULT NULL,
      p_reversa_telefone TEXT DEFAULT NULL,
      p_reversa_data_realizada DATE DEFAULT NULL,
      p_reversa_fotos JSONB DEFAULT NULL,
      p_reversa_assinatura_url TEXT DEFAULT NULL,
      p_reversa_latitude NUMERIC DEFAULT NULL,
      p_reversa_longitude NUMERIC DEFAULT NULL,
      p_auth_user_id UUID DEFAULT NULL
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
    DECLARE
      v_alocacao RECORD;
      v_qtd_prevista INTEGER;
      v_divergencia TEXT;
      v_divergencia_num INTEGER;
      v_evento_tipo TEXT;
      v_valor_cliente NUMERIC;
      v_valor_prestador NUMERIC;
      v_os_id UUID;
    BEGIN
      IF p_auth_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
          RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário inválido');
        END IF;
      END IF;
      SELECT * INTO v_alocacao FROM public.alocacoes_escala WHERE id = p_alocacao_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
      END IF;
      v_os_id := v_alocacao.ordem_servico_id;
      v_qtd_prevista := COALESCE(v_alocacao.reversa_qtd_volumes, 0);
      IF p_reversa_qtd_coletada IS NOT NULL AND v_qtd_prevista > 0 THEN
        v_divergencia_num := p_reversa_qtd_coletada - v_qtd_prevista;
        v_divergencia := CASE WHEN v_divergencia_num = 0 THEN 'sem_divergencia'
          WHEN v_divergencia_num < 0 THEN 'faltante' ELSE 'excedente' END;
      END IF;
      v_evento_tipo := CASE
        WHEN p_reversa_status = 'em_coleta' THEN 'reversa_iniciada'
        WHEN p_reversa_status = 'coletada' AND v_divergencia = 'sem_divergencia' THEN 'reversa_coletada'
        WHEN p_reversa_status = 'coletada' AND v_divergencia IN ('faltante','excedente') THEN 'reversa_divergente'
        WHEN p_reversa_status = 'em_devolucao' THEN 'reversa_em_devolucao'
        WHEN p_reversa_status = 'devolvida' THEN 'reversa_devolvida'
        WHEN p_reversa_status = 'divergente' THEN 'reversa_divergente'
        ELSE 'reversa_atualizada' END;
      v_valor_cliente := COALESCE(v_alocacao.reversa_valor_cliente, 0);
      v_valor_prestador := COALESCE(v_alocacao.reversa_valor_prestador, 0);
      IF p_reversa_qtd_coletada IS NOT NULL AND p_reversa_qtd_coletada > 0
         AND COALESCE(v_alocacao.reversa_valor_unitario, 0) > 0 THEN
        v_valor_cliente := p_reversa_qtd_coletada * COALESCE(v_alocacao.reversa_valor_unitario, 0);
        v_valor_prestador := p_reversa_qtd_coletada * COALESCE(v_alocacao.reversa_valor_unitario, 0) * 0.6;
      END IF;
      UPDATE public.alocacoes_escala SET
        reversa_status = COALESCE(p_reversa_status, reversa_status),
        reversa_qtd_coletada = COALESCE(p_reversa_qtd_coletada, reversa_qtd_coletada),
        reversa_motivo_divergencia = COALESCE(p_reversa_motivo_divergencia,
          CASE WHEN v_divergencia IS NOT NULL AND v_divergencia != 'sem_divergencia' THEN
            format('Divergencia %s: %s de %s', v_divergencia, p_reversa_qtd_coletada, v_qtd_prevista)
          ELSE reversa_motivo_divergencia END),
        reversa_responsavel = COALESCE(p_reversa_responsavel, reversa_responsavel),
        reversa_telefone = COALESCE(p_reversa_telefone, reversa_telefone),
        reversa_data_realizada = COALESCE(p_reversa_data_realizada, reversa_data_realizada),
        reversa_fotos = CASE WHEN p_reversa_fotos IS NOT NULL THEN p_reversa_fotos ELSE reversa_fotos END,
        reversa_assinatura_url = COALESCE(p_reversa_assinatura_url, reversa_assinatura_url),
        reversa_latitude = COALESCE(p_reversa_latitude, reversa_latitude),
        reversa_longitude = COALESCE(p_reversa_longitude, reversa_longitude),
        reversa_realizada_em = CASE WHEN p_reversa_status IN ('coletada','devolvida','divergente','em_coleta','em_devolucao')
          THEN NOW() ELSE reversa_realizada_em END,
        reversa_valor_cliente = v_valor_cliente,
        reversa_valor_prestador = v_valor_prestador,
        updated_at = NOW()
      WHERE id = p_alocacao_id;
      -- Timeline event (usando colunas oficiais de eventos_oficiais)
      INSERT INTO public.eventos_oficiais (event_type, entity_type, entity_id, source, payload, metadata)
      VALUES (v_evento_tipo, 'alocacao', p_alocacao_id::text, 'app_motorista',
        jsonb_build_object('message', format('Reversa: status=%s, qtd=%s/%s',
          COALESCE(p_reversa_status, ''), COALESCE(p_reversa_qtd_coletada::text, '0'), v_qtd_prevista)),
        jsonb_build_object('alocacao_id', p_alocacao_id, 'os_id', v_os_id,
          'reversa_status', COALESCE(p_reversa_status, ''),
          'qtd_prevista', v_qtd_prevista, 'qtd_coletada', p_reversa_qtd_coletada,
          'divergencia', v_divergencia, 'divergencia_num', v_divergencia_num,
          'valor_cliente', v_valor_cliente, 'valor_prestador', v_valor_prestador));
      -- Atualizar financeiro
      IF p_reversa_qtd_coletada IS NOT NULL AND p_reversa_qtd_coletada > 0 AND v_os_id IS NOT NULL THEN
        UPDATE public.financeiro_receber SET valor = COALESCE(v_alocacao.valor_frete, 0) + v_valor_cliente
        WHERE os_id = v_os_id::text;
        UPDATE public.financeiro_pagar SET valor = COALESCE(v_alocacao.valor_repasse, 0) + v_valor_prestador
        WHERE os_id = v_os_id::text;
      END IF;
      RETURN jsonb_build_object('sucesso', true, 'alocacao_id', p_alocacao_id,
        'evento', v_evento_tipo, 'divergencia', v_divergencia,
        'qtd_prevista', v_qtd_prevista, 'qtd_coletada', p_reversa_qtd_coletada,
        'valor_cliente', v_valor_cliente, 'valor_prestador', v_valor_prestador);
    END;
    $func$;
  `);
  console.log('RPC updated with correct eventos_oficiais columns');
  
  const rpcTest = await client.query(`SELECT proname, prosrc FROM pg_proc WHERE proname='f_atualizar_reversa_app'`);
  const src = rpcTest.rows[0].prosrc;
  console.log('Contains eventos_oficiais insert:', src.includes('eventos_oficiais'));
  console.log('Contains financeiro_receber update:', src.includes('financeiro_receber'));
  console.log('Contains financeiro_pagar update:', src.includes('financeiro_pagar'));
  
  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
