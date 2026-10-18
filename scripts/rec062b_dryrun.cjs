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

  // Replace COMMIT with ROLLBACK for dry-run
  const dryRun = sql.replace('COMMIT;', 'ROLLBACK;');

  console.log('=== DRY RUN (BEGIN/ROLLBACK) ===');
  try {
    await c.query(dryRun);
    console.log('✅ SQL syntax valid — no errors');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    await c.end();
    process.exit(1);
  }

  // Verify rollback worked — check recrutamento_operacoes still has anon
  const check = await c.query(`
    SELECT polname, (SELECT array_agg(r.rolname) FROM unnest(polroles) rid JOIN pg_roles r ON r.oid = rid) AS roles
    FROM pg_policy WHERE polrelid = 'recrutamento_operacoes'::regclass
  `);
  console.log('\n=== POST-ROLLBACK CHECK (should still have anon) ===');
  for (const row of check.rows) {
    console.log(`  ${row.polname}: roles=${JSON.stringify(row.roles)}`);
  }

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
