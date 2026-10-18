const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();

  console.log('=== COLUNAS ===');
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'pagamentos_prestadores' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(r => {
    const k = ['tenant_id','prestador_id','created_by','os_id','fechamento_id'].includes(r.column_name) ? ' KEY' : '';
    console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable==='YES'?'NULL':'NOT NULL'}${k}`);
  });

  console.log('\n=== FKs ===');
  const fks = await c.query(`
    SELECT kcu.column_name, ccu.table_name AS ftable, ccu.column_name AS fcol
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
    WHERE tc.table_name = 'pagamentos_prestadores' AND tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  fks.rows.forEach(r => console.log(`  ${r.column_name} -> ${r.ftable}.${r.fcol}`));

  console.log('\n=== RLS ===');
  const rls = await c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'pagamentos_prestadores'`);
  console.log(`  enabled: ${rls.rows[0]?.relrowsecurity}, force: ${rls.rows[0]?.relforcerowsecurity}`);

  console.log('\n=== POLICIES ===');
  const pol = await c.query(`SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'pagamentos_prestadores'`);
  pol.rows.forEach(r => {
    console.log(`  ${r.policyname}: ${r.cmd} roles=${r.roles}`);
    if (r.qual) console.log(`    USING: ${r.qual.substring(0,120)}`);
    if (r.with_check) console.log(`    CHECK: ${r.with_check.substring(0,120)}`);
  });

  console.log('\n=== TENANT_ID DATA ===');
  try {
    const t = await c.query(`SELECT tenant_id, count(*) AS n FROM pagamentos_prestadores GROUP BY tenant_id`);
    t.rows.forEach(r => console.log(`  ${r.tenant_id}: ${r.n} registros`));
  } catch(e) { console.log(`  ${e.message}`); }

  console.log('\n=== PRESTADOR_ID NULL CHECK ===');
  const pn = await c.query(`SELECT count(*) AS total, count(prestador_id) AS com_prestador FROM pagamentos_prestadores`);
  console.log(`  Total: ${pn.rows[0].total}, Com prestador: ${pn.rows[0].com_prestador}, Sem: ${pn.rows[0].total - pn.rows[0].com_prestador}`);

  console.log('\n=== PP TOTAL ===');
  const total = await c.query(`SELECT count(*) AS n, count(DISTINCT prestador_id) AS prestadores FROM pagamentos_prestadores`);
  console.log(`  ${total.rows[0].n} registros, ${total.rows[0].prestadores} prestadores distintos`);

  await c.end();
})();
