import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT is_teste, count(*) as total FROM financeiro_pagar GROUP BY is_teste`);
  console.log("is_teste distribution:");
  r.rows.forEach(row => console.log(`  ${row.is_teste}: ${row.total}`));
  // Check existing titles with categoria Material (same as our test)
  const mat = await c.query(`SELECT count(*) as t FROM financeiro_pagar WHERE categoria = 'Material' AND is_teste = false`);
  console.log(`\nExisting 'Material' titles (is_teste=false): ${mat.rows[0].t}`);
  await c.end();
})();
