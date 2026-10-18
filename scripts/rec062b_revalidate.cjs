const { Client } = require('pg');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = [
    'recrutamento_prestadores',
    'recrutamento_candidatos',
    'crm_interacoes_prestadores',
    'candidato_documentos',
    'recrutamento_operacoes',
  ];

  for (const t of tables) {
    console.log(`\n=== ${t} ===`);
    const r = await c.query(`
      SELECT
        p.polname,
        p.polcmd,
        CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' ELSE p.polcmd::text END AS cmd_name,
        pg_get_expr(p.polqual, p.polrelid) AS using_expr,
        pg_get_expr(p.polwithcheck, p.polrelid) AS withcheck_expr,
        (SELECT array_agg(r.rolname) FROM unnest(p.polroles) rid JOIN pg_roles r ON r.oid = rid) AS roles,
        p.polpermissive
      FROM pg_policy p
      WHERE p.polrelid = $1::regclass
      ORDER BY p.polname
    `, [t]);
    for (const row of r.rows) {
      console.log(`  ${row.polname} | ${row.cmd_name} | permissive=${row.polpermissive} | roles=${JSON.stringify(row.roles)} | USING=${row.using_expr || '(none)'} | WCHECK=${row.withcheck_expr || '(none)'}`);
    }
    if (r.rows.length === 0) console.log('  (no policies)');
  }

  // Check grants for anon on these tables
  console.log('\n=== anon grants summary ===');
  for (const t of tables) {
    const g = await c.query(`
      SELECT privilege_type FROM information_schema.table_privileges
      WHERE table_name = $1 AND grantee = 'anon'
      ORDER BY privilege_type
    `, [t]);
    console.log(`  ${t}: anon has [${g.rows.map(r => r.privilege_type).join(', ')}]`);
  }

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
