const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='trg_evento_os_status_changed'`);
  if (!r.rows.length) { console.log('fn nao encontrada'); }
  else {
    const d = r.rows[0].d;
    console.log('len', d.length, 'valida_transicao=', /TRANSICAO|permitida|permitidas|RAISE EXCEPTION.*status/i.test(d));
    console.log(d.substring(0, 800));
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
