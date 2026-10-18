const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_trg_propagar_financeiro_os'`);
  const d = r.rows[0].d;
  const i = d.indexOf('v_outros_custos');
  console.log('=== M80 v_outros_custos contexto ===');
  console.log(d.substring(Math.max(0, i - 300), i + 700));
  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
