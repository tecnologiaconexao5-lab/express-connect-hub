const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='ordens_servico' AND column_name='status'`);
  console.log('OS.status:', JSON.stringify(r.rows[0]));
  const r2 = await c.query(`SELECT status, count(*) n FROM ordens_servico GROUP BY status ORDER BY n DESC`);
  console.log('live:', r2.rows.map(x => `${x.status}=${x.n}`).join(', '));
  const r3 = await c.query(`SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='alocacoes_escala' AND column_name='status'`);
  console.log('Escala.status:', JSON.stringify(r3.rows[0]));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
