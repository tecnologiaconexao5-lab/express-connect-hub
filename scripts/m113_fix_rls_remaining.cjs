const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check usuarios_cliente columns
  const ucCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='usuarios_cliente' ORDER BY ordinal_position`);
  console.log('usuarios_cliente columns:', ucCols.rows.map(c => c.column_name).join(', '));

  // Check remaining "liberar" and "allow_all" policies 
  const badPolicies = await client.query(`
    SELECT tablename, policyname, cmd, roles FROM pg_policies
    WHERE policyname LIKE '%liberar%' OR policyname LIKE '%allow_all%'
    ORDER BY tablename
  `);
  console.log(`\nRemaining ${badPolicies.rows.length} bad policies:`);
  for (const p of badPolicies.rows) {
    console.log(`  ${p.tablename}: ${p.policyname} (${p.cmd}) roles=${p.roles}`);
  }

  // Check f_obter_cliente_id_do_usuario function
  const fnCheck = await client.query(`
    SELECT proname, prosrc FROM pg_proc WHERE proname = 'f_obter_cliente_id_do_usuario'
  `);
  console.log(`\nf_obter_cliente_id_do_usuario exists: ${fnCheck.rows.length > 0}`);

  // Drop remaining bad policies for portal tables
  const portalTables = ['clientes','ordens_servico','financeiro_receber','financeiro_pagar','prestadores',
    'veiculos','os_historico','entregas_protocolo','portal_pedidos','portal_notificacoes',
    'portal_ocorrencias','portal_avaliacoes','portal_faturas','portal_protocolos',
    'portal_rotas','portal_comprovantes','portal_relatorios','portal_tracking_realtime',
    'portal_preferencias_cliente'];

  console.log('\nDropping remaining bad policies...');
  for (const row of badPolicies.rows) {
    try {
      await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.${row.tablename}`);
      console.log(`  ✅ Dropped ${row.policyname} on ${row.tablename}`);
    } catch(e) {
      console.log(`  ❌ ${e.message.substring(0, 80)}`);
    }
  }

  // Verify
  const remaining = await client.query(`
    SELECT count(*) FROM pg_policies
    WHERE policyname LIKE '%liberar%' OR policyname LIKE '%allow_all%'
  `);
  console.log(`\nRemaining bad policies: ${remaining.rows[0].count}`);

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
