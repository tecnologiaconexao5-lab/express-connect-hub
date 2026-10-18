const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await pool.query(
    "SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'alocacoes_escala' ORDER BY ordinal_position"
  );
  for (const c of r.rows) console.log(c.column_name.padEnd(28), c.udt_name);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });