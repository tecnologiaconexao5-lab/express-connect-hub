import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000});
const triggers = await pool.query(`
  SELECT tgname, tgtype FROM pg_trigger
  JOIN pg_class ON pg_class.oid = tgrelid
  WHERE pg_class.relname = 'portal_pedidos' AND tgname NOT LIKE 'pg_%'
`);
for (const r of triggers.rows) {
  console.log(`Trigger: ${r.tgname} (type: ${r.tgtype})`);
}
const funcDef = await pool.query(`
  SELECT tgname, pg_get_triggerdef(tgrelid::regclass::text || ' ' || tgname::text) AS def
  FROM pg_trigger
  JOIN pg_class ON pg_class.oid = tgrelid
  WHERE pg_class.relname = 'portal_pedidos' AND tgname NOT LIKE 'pg_%' AND tgname NOT LIKE '%update%'
`);
// Alternative: Get the trigger function name and its definition
const funcs = await pool.query(`
  SELECT tgname, tgfoid::regproc::text AS funcname
  FROM pg_trigger
  JOIN pg_class ON pg_class.oid = tgrelid
  WHERE pg_class.relname = 'portal_pedidos' AND tgname NOT LIKE 'pg_%'
`);
for (const r of funcs.rows) {
  const src = await pool.query(`SELECT pg_get_functiondef('${r.funcname}'::regproc)`);
  console.log(`\n--- ${r.tgname} → ${r.funcname} ---`);
  console.log(src.rows[0]?.pg_get_functiondef?.substring(0, 500) || '?');
}
await pool.end();
