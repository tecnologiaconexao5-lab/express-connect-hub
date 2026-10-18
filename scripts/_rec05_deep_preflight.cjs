const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Search ALL schemas for candidato_documentos
  const allSchemas = await c.query(`
    SELECT table_schema, table_name FROM information_schema.tables 
    WHERE table_name LIKE '%candidato%' OR table_name LIKE '%documento%' OR table_name LIKE '%document%'
    ORDER BY table_schema, table_name
  `);
  console.log('=== ALL tables with candidato/documento/document ===');
  allSchemas.rows.forEach(r => console.log('  ' + r.table_schema + '.' + r.table_name));

  // 2. Check if candidato_documentos exists in any schema
  const cdAny = await c.query(`
    SELECT table_schema, table_name FROM information_schema.tables 
    WHERE table_name = 'candidato_documentos'
  `);
  console.log('\n=== candidato_documentos in any schema ===');
  if (cdAny.rows.length === 0) console.log('  NOT FOUND in any schema');
  cdAny.rows.forEach(r => console.log('  ' + r.table_schema + '.' + r.table_name));

  // 3. Check if there's a migration that creates candidato_documentos
  const migrations = await c.query(`
    SELECT schemaname, tablename FROM pg_tables 
    WHERE tablename LIKE '%candidato%' OR tablename LIKE '%documento%'
    ORDER BY schemaname, tablename
  `);
  console.log('\n=== pg_tables candidato/documento ===');
  migrations.rows.forEach(r => console.log('  ' + r.schemaname + '.' + r.tablename));

  // 4. Check candidatos table structure
  const candidatosCols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='candidatos' AND table_schema='public' ORDER BY ordinal_position");
  console.log('\n=== candidatos columns ===');
  candidatosCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable));

  // 5. candidatos count
  const cCount = await c.query('SELECT COUNT(*) as cnt FROM public.candidatos');
  console.log('\n=== candidatos count ===', cCount.rows[0].cnt);

  // 6. candidatos has documentos JSONB?
  const hasJsonb = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='candidatos' AND column_name='documentos' AND data_type='jsonb') as has");
  console.log('=== candidatos has documentos JSONB ===', hasJsonb.rows[0].has);

  // 7. Check if there are migrations in the migrations table
  const migTable = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='schema_migrations' AND table_schema='public') as has");
  console.log('\n=== schema_migrations table exists ===', migTable.rows[0].has);

  // 8. List all public tables
  const allPublic = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('\n=== ALL public tables ===');
  allPublic.rows.forEach(r => console.log('  ' + r.tablename));

  await c.end();
  console.log('\n=== DEEP PREFLIGHT COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
