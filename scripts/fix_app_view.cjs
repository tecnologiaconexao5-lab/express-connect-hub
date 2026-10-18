const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  // Get current view definition
  const viewDef = await client.query(`
    SELECT viewname, definition FROM pg_views 
    WHERE viewname = 'vw_app_motorista_operacoes' AND schemaname = 'public'
  `);
  
  if (viewDef.rows.length > 0) {
    console.log('=== Current view definition ===');
    console.log(viewDef.rows[0].definition);
    console.log('\n--- contains reversa_valor_cliente: ' + viewDef.rows[0].definition.includes('reversa_valor_cliente'));
    console.log('--- contains reversa_valor_prestador: ' + viewDef.rows[0].definition.includes('reversa_valor_prestador'));
  }

  // Recreate view without reversa_valor_cliente
  console.log('\n=== Recreating view without reversa_valor_cliente ===');
  await client.query(`
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
      a.reversa_qtd_coletada,
      a.reversa_unidade_cobranca,
      a.reversa_motivo_divergencia,
      a.reversa_responsavel,
      a.reversa_telefone,
      a.reversa_data_prevista,
      a.reversa_observacoes,
      a.reversa_endereco_coleta,
      a.reversa_endereco_devolucao,
      a.reversa_valor_prestador,
      a.reversa_pod_url,
      a.reversa_fotos,
      a.reversa_realizada_em,
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
    WHERE a.prestador_id IS NOT NULL
  `);

  console.log('View recreated successfully!');

  // Verify
  const verif = await client.query(`
    SELECT viewname, definition FROM pg_views 
    WHERE viewname = 'vw_app_motorista_operacoes' AND schemaname = 'public'
  `);
  const def = verif.rows[0].definition;
  console.log('\n=== Verification ===');
  console.log('Contains reversa_valor_cliente: ' + def.includes('reversa_valor_cliente'));
  console.log('Contains reversa_valor_prestador: ' + def.includes('reversa_valor_prestador'));
  console.log('Contains reversa_qtd_coletada: ' + def.includes('reversa_qtd_coletada'));
  console.log('Contains reversa_endereco_coleta: ' + def.includes('reversa_endereco_coleta'));
  console.log('Contains reversa_endereco_devolucao: ' + def.includes('reversa_endereco_devolucao'));
  console.log('Contains reversa_fotos: ' + def.includes('reversa_fotos'));
  
  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
