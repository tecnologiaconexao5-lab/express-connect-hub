require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='alocacoes_escala' AND table_schema='public' ORDER BY ordinal_position");
  console.log(JSON.stringify(r.rows.map(x => x.column_name), null, 2));
  await c.end();
})();
