const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Check tables exist
  const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('candidato_documentos','recrutamento_candidatos','candidatos') ORDER BY table_name");
  console.log('=== TABLES ===');
  tables.rows.forEach(r => console.log('  ' + r.table_name));

  // 2. candidato_documentos columns
  const cdCols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='candidato_documentos' AND table_schema='public' ORDER BY ordinal_position");
  console.log('\n=== candidato_documentos columns ===');
  cdCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable));

  // 3. recrutamento_candidatos columns
  const rcCols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='recrutamento_candidatos' AND table_schema='public' ORDER BY ordinal_position");
  console.log('\n=== recrutamento_candidatos columns ===');
  rcCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable));

  // 4. candidatos table?
  const candidatosExists = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='candidatos' AND table_schema='public') as exists");
  console.log('\n=== candidatos table exists ===', candidatosExists.rows[0].exists);

  // 5. FK constraints on candidato_documentos
  const fks = await c.query(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'candidato_documentos' AND tc.table_schema = 'public'
  `);
  console.log('\n=== FK constraints on candidato_documentos ===');
  if (fks.rows.length === 0) console.log('  (none)');
  fks.rows.forEach(r => console.log('  ' + r.constraint_name + ': ' + r.column_name + ' -> ' + r.foreign_table_name + '.' + r.foreign_column_name));

  // 6. Record counts
  const cdCount = await c.query('SELECT COUNT(*) as cnt FROM public.candidato_documentos');
  const rcCount = await c.query('SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos');
  console.log('\n=== Record counts ===');
  console.log('  candidato_documentos:', cdCount.rows[0].cnt);
  console.log('  recrutamento_candidatos:', rcCount.rows[0].cnt);

  // 7. Orphan check: docs without matching recrutamento_candidatos
  const orphans = await c.query(`
    SELECT COUNT(*) as cnt FROM public.candidato_documentos cd
    LEFT JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
    WHERE rc.id IS NULL
  `);
  console.log('\n=== Orphan docs (no matching recrutamento_candidatos) ===', orphans.rows[0].cnt);

  // 8. NULL candidato_id check
  const nulls = await c.query('SELECT COUNT(*) as cnt FROM public.candidato_documentos WHERE candidato_id IS NULL');
  console.log('=== NULL candidato_id ===', nulls.rows[0].cnt);

  // 9. Cross-tenant check
  const rcHasTenant = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='recrutamento_candidatos' AND column_name='tenant_id') as has");
  const cdHasTenant = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='candidato_documentos' AND column_name='tenant_id') as has");
  console.log('\n=== tenant_id ===');
  console.log('  recrutamento_candidatos:', rcHasTenant.rows[0].has);
  console.log('  candidato_documentos:', cdHasTenant.rows[0].has);

  if (rcHasTenant.rows[0].has && cdHasTenant.rows[0].has) {
    const cross = await c.query(`
      SELECT COUNT(*) as cnt FROM public.candidato_documentos cd
      JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
      WHERE cd.tenant_id IS NOT NULL AND rc.tenant_id IS NOT NULL AND cd.tenant_id != rc.tenant_id
    `);
    console.log('  Cross-tenant mismatches:', cross.rows[0].cnt);
  }

  // 10. candidatos orphans (if table exists)
  if (candidatosExists.rows[0].exists) {
    const cCount = await c.query('SELECT COUNT(*) as cnt FROM public.candidatos');
    console.log('\n=== candidatos count ===', cCount.rows[0].cnt);
    const rcOrphans = await c.query(`
      SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos rc
      LEFT JOIN public.candidatos c ON c.id = rc.id
      WHERE c.id IS NULL
    `);
    console.log('=== recrutamento_candidatos without matching candidatos ===', rcOrphans.rows[0].cnt);
  }

  // 11. Sample data from candidato_documentos
  const sampleDocs = await c.query('SELECT id, candidato_id, tipo_documento, status, tenant_id FROM public.candidato_documentos LIMIT 5');
  console.log('\n=== candidato_documentos sample (5) ===');
  sampleDocs.rows.forEach(r => console.log('  id=' + r.id + ' candidato_id=' + r.candidato_id + ' tipo=' + r.tipo_documento + ' status=' + r.status + ' tenant=' + r.tenant_id));

  // 12. Sample data from recrutamento_candidatos
  const sampleRC = await c.query('SELECT id, nome_completo, status, tenant_id FROM public.recrutamento_candidatos LIMIT 5');
  console.log('\n=== recrutamento_candidatos sample (5) ===');
  sampleRC.rows.forEach(r => console.log('  id=' + r.id + ' nome=' + r.nome_completo + ' status=' + r.status + ' tenant=' + r.tenant_id));

  await c.end();
  console.log('\n=== PREFLIGHT COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
