const { Client } = require('pg');
const fs = require('fs');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const sql = fs.readFileSync(
    'C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\supabase\\migrations\\20260907_rec_062b_fix_rls_recrutamento.sql',
    'utf-8'
  );

  console.log('=== APPLYING MIGRATION (COMMIT) ===');
  try {
    const result = await c.query(sql);
    console.log('✅ Migration applied successfully');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    await c.end();
    process.exit(1);
  }

  // Verify applied
  console.log('\n=== POST-APPLY VERIFICATION ===');
  const tables = ['recrutamento_operacoes', 'crm_interacoes_prestadores'];
  for (const t of tables) {
    const r = await c.query(`
      SELECT polname,
        (SELECT array_agg(r.rolname) FROM unnest(polroles) rid JOIN pg_roles r ON r.oid = rid) AS roles,
        pg_get_expr(polqual, polrelid) AS using_expr
      FROM pg_policy WHERE polrelid = $1::regclass ORDER BY polname
    `, [t]);
    console.log(`\n  ${t}:`);
    for (const row of r.rows) {
      console.log(`    ${row.polname}: roles=${JSON.stringify(row.roles)} | USING=${row.using_expr || '(none)'}`);
    }
  }

  // Check grants
  console.log('\n=== POST-APPLY GRANTS ===');
  for (const t of ['recrutamento_operacoes', 'crm_interacoes_prestadores', 'recrutamento_prestadores', 'recrutamento_candidatos', 'candidato_documentos']) {
    const g = await c.query(`
      SELECT privilege_type FROM information_schema.table_privileges
      WHERE table_name = $1 AND grantee = 'anon' ORDER BY privilege_type
    `, [t]);
    console.log(`  ${t}: anon has [${g.rows.map(r => r.privilege_type).join(', ') || 'NONE'}]`);
  }

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
