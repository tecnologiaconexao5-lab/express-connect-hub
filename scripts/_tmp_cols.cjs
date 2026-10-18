require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'alocacoes_escala' ORDER BY ordinal_position");
  console.log(r.rows.map(x => x.column_name).join(', '));
  await c.end();
})();
