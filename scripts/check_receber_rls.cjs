const pg = require("pg");
const c = new pg.Client({
  connectionString: "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
});
c.connect().then(async () => {
  // Check RLS policies on financeiro_receber
  const policies = await c.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'financeiro_receber'
    ORDER BY policyname
  `);
  console.log("=== financeiro_receber RLS policies ===");
  policies.rows.forEach(p => {
    console.log(`  ${p.policyname} | ${p.permissive} | ${p.roles} | ${p.cmd}`);
    console.log(`    USING: ${p.qual}`);
    if (p.with_check) console.log(`    CHECK: ${p.with_check}`);
  });

  // Check if RLS is enabled
  const rls = await c.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relname = 'financeiro_receber'
  `);
  console.log(`\n  RLS enabled: ${rls.rows[0]?.relrowsecurity}`);
  console.log(`  Force RLS: ${rls.rows[0]?.relforcerowsecurity}`);

  // Check how many records exist
  const count = await c.query("SELECT count(*) FROM financeiro_receber");
  console.log(`\n  Total records: ${count.rows[0].count}`);

  await c.end();
}).catch(e => console.error(e.message));
