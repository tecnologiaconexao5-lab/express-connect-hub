import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'os_historico'
  ORDER BY ordinal_position
`);
for (const row of r.rows) {
  console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
}
const r2 = await c.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ordens_servico'
  AND column_name IN ('prestador', 'prestador_id', 'cliente', 'cliente_id')
`);
for (const row of r2.rows) {
  console.log(`  ordens_servico.${row.column_name} (${row.data_type})`);
}
await c.end();
