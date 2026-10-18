const pg = require('pg');
const client = new pg.Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  // Check triggers on alocacoes_escala
  const triggers = await client.query(`
    SELECT tgname, tgtype::int, pg_get_triggerdef(t.oid) as def
    FROM pg_trigger t
    WHERE tgrelid = 'public.alocacoes_escala'::regclass
      AND NOT tgisinternal
    ORDER BY tgname
  `);
  console.log('=== Triggers on alocacoes_escala ===');
  triggers.rows.forEach(t => console.log(`  ${t.tgname}: ${t.def?.substring(0, 200)}`));

  // Check triggers on ordens_servico
  const osTriggers = await client.query(`
    SELECT tgname, pg_get_triggerdef(t.oid) as def
    FROM pg_trigger t
    WHERE tgrelid = 'public.ordens_servico'::regclass
      AND NOT tgisinternal
    ORDER BY tgname
  `);
  console.log('\n=== Triggers on ordens_servico ===');
  osTriggers.rows.forEach(t => console.log(`  ${t.tgname}: ${t.def?.substring(0, 200)}`));

  // Check Event Bus triggers
  const ebTriggers = await client.query(`
    SELECT tgname, tgrelid::regclass AS tbl
    FROM pg_trigger t
    WHERE tgname LIKE '%evento%' OR tgname LIKE '%event_bus%'
      AND NOT tgisinternal
    ORDER BY tgname
  `);
  console.log('\n=== Event Bus Triggers ===');
  ebTriggers.rows.forEach(t => console.log(`  ${t.tgname} on ${t.tbl}`));

  // Check NOTIFICACOES table
  const notifTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%notificacao%' OR table_name LIKE '%notificacoe%')
  `);
  console.log('\n=== Notification tables ===');
  notifTables.rows.forEach(t => console.log(`  ${t.table_name}`));
  
  // Check ROTAS tables
  const rotaTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%rota%' OR table_name LIKE '%parada%' OR table_name LIKE '%route%' OR table_name LIKE '%stop%')
    ORDER BY table_name
  `);
  console.log('\n=== Rota/Parada tables ===');
  rotaTables.rows.forEach(t => console.log(`  ${t.table_name}`));
  
  // Check rotas columns
  const r = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'rotas' ORDER BY ordinal_position
  `);
  if (r.rows.length > 0) {
    console.log('\n=== Rotas columns ===');
    r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  }

  // Check rota_paradas columns  
  const rp = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'rota_paradas' ORDER BY ordinal_position
  `);
  if (rp.rows.length > 0) {
    console.log('\n=== Rota_paradas columns ===');
    rp.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  }

  // Check event_bus tables
  const eventTables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE '%evento%' OR table_name LIKE '%event_bus%'
    ORDER BY table_name
  `);
  console.log('\n=== Event tables ===');
  eventTables.rows.forEach(t => console.log(`  ${t.table_name}`));

  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
