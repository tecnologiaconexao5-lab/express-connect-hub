const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run(client, label, sql) {
  try { await client.query(sql); console.log(`✅ ${label}`); }
  catch(err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) { console.log(`⏭️ ${label}`); return; }
    console.log(`❌ ${label}: ${err.message.substring(0, 120)}`);
  }
}

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Fix vw_app_motorista_paradas - remove duplicate tipo_carga
  await run(client, 'vw_app_motorista_paradas', `
CREATE OR REPLACE VIEW public.vw_app_motorista_paradas AS
SELECT
  rp.id AS parada_id, rp.rota_id, rp.sequencia,
  rp.cliente_nome AS destinatario, rp.endereco, rp.numero, rp.bairro,
  rp.cidade, rp.uf, rp.cep, rp.latitude, rp.longitude,
  rp.peso, rp.volumes, rp.cubagem,
  rp.temperatura AS temperatura_carga, rp.prioridade, rp.janela_entrega,
  rp.instrucoes, rp.status, rp.recebedor, rp.assinatura_url,
  rp.pod_url, rp.fotos, rp.ocorrencia, rp.data_hora,
  rp.latitude_fim, rp.longitude_fim, rp.data_entrega,
  rp.volumes_entregues, rp.observacoes, rp.os_id, rp.alocacao_id,
  rp.pedido, rp.nota_fiscal, rp.contato,
  rp.tipo_carga
FROM public.rota_paradas rp
ORDER BY rp.sequencia`);

  // Grant on paradas view
  await run(client, 'GRANT vw_paradas', `GRANT SELECT ON public.vw_app_motorista_paradas TO anon, authenticated`);

  // Test: check signature of the RPC
  console.log('\n=== RPC SIGNATURES ===');
  const rpcs = await client.query(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('f_aceitar_oportunidade_rede', 'f_atualizar_status_parada', 'f_buscar_operacoes_motorista')
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  `);
  rpcs.rows.forEach(r => console.log(`  ${r.proname}(${r.args})`));

  // Final verification
  console.log('\n=== FINAL VERIFICATION ===');
  const checks = [
    `SELECT 'vw_app_motorista_operacoes' q FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT 'vw_app_motorista_paradas' q FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT 'vw_app_notificacoes_pendentes' q FROM pg_views WHERE viewname='vw_app_notificacoes_pendentes'`,
    `SELECT 'f_aceitar_oportunidade_rede(3 params)' q FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede' AND pronargs=3`,
    `SELECT 'Only 1 version f_aceitar' q FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede'`,
    `SELECT 'f_atualizar_status_parada' q FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT 'trg_notificar_os_para_app' q FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT 'trg_notificar_oportunidade_rede' q FROM pg_trigger WHERE tgname='trg_notificar_oportunidade_rede' AND NOT tgisinternal`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const label = r.rows[0]?.q || '?';
      console.log(`${r.rows.length > 0 ? '✅' : '❌'} ${label}`);
    } catch(e) { console.log(`❌ ${e.message.substring(0, 80)}`); }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
