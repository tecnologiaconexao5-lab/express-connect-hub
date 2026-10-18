import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='financeiro_pagar' AND column_name LIKE 'fornecedor%' ORDER BY ordinal_position`);
  console.log(r.rows.map(x => x.column_name).join('\n'));
  await c.end();
})();
