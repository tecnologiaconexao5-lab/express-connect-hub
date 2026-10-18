const pg = require('pg');
const client = new pg.Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('=== CONNECTED ===\n');

  // Check specific tables
  const tablesToCheck = ['rede_oportunidades', 'rede_visualizacoes', 'alocacoes_escala', 'ordens_servico'];
  for (const tbl of tablesToCheck) {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tbl]);
    console.log(`\n=== ${tbl} (${res.rows.length} columns) ===`);
    res.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default || 'none'}`));
  }

  // Check RPCs
  const rpcs = await client.query(`
    SELECT proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (proname LIKE '%aceitar%' OR proname LIKE '%oportunidade%' OR proname LIKE '%reversa%')
    ORDER BY proname
  `);
  console.log('\n=== Matching RPCs ===');
  rpcs.rows.forEach(r => console.log(`  ${r.name}(${r.args})`));

  // Check RLS on rede_oportunidades
  const rls = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'rede_oportunidades'
  `);
  console.log('\n=== RLS rede_oportunidades ===', JSON.stringify(rls.rows));

  // Check existing policies
  const policies = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE tablename = 'rede_oportunidades'
  `);
  console.log('\n=== Policies rede_oportunidades ===');
  policies.rows.forEach(p => console.log(`  ${p.policyname}: ${p.cmd} roles=${p.roles}`));

  // Check triggers
  const triggers = await client.query(`
    SELECT tgname, tgrelid::regclass AS table_name
    FROM pg_trigger
    WHERE tgname LIKE '%rede%' OR tgname LIKE '%oportunidade%' OR tgname LIKE '%reversa%'
      AND NOT tgisinternal
  `);
  console.log('\n=== Matching Triggers ===');
  triggers.rows.forEach(t => console.log(`  ${t.tgname} on ${t.table_name}`));

  // Check índices
  const indices = await client.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public' 
      AND (tablename = 'rede_oportunidades' OR tablename = 'alocacoes_escala')
    ORDER BY tablename, indexname
  `);
  console.log('\n=== Indexes ===');
  indices.rows.forEach(i => console.log(`  ${i.tablename}: ${i.indexname}`));

  // Check publication for realtime
  const pubTables = await client.query(`
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE schemaname = 'public'
      AND tablename IN ('rede_oportunidades', 'rede_visualizacoes', 'alocacoes_escala')
  `);
  console.log('\n=== Realtime Publications ===');
  pubTables.rows.forEach(p => console.log(`  ${p.schemaname}.${p.tablename}`));

  // Check existencia das colunas especificas na OS
  const osReversaCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'ordens_servico' 
      AND column_name IN ('tipo_reversa', 'reversa_qtd_volumes', 'reversa_observacoes', 'tipo_operacao')
  `);
  console.log('\n=== OS Reversa columns found ===', osReversaCheck.rows.map(r => r.column_name));

  // Check existencia das colunas especificas na alocacao
  const alocReversaCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'alocacoes_escala' 
      AND column_name IN ('tipo_reversa', 'reversa_valor_cliente', 'reversa_valor_prestador', 'reversa_qtd_volumes', 'reversa_status', 'reversa_pod_url', 'reversa_fotos')
  `);
  console.log('\n=== Alocacoes Reversa columns found ===', alocReversaCheck.rows.map(r => r.column_name));

  await client.end();
  console.log('\n=== DONE ===');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
