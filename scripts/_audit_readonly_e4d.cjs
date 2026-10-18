const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  const d = r.rows[0].d;
  fs.writeFileSync('scripts/_e4c_live_fn.sql', d, 'utf8');
  const matches = [...d.matchAll(/auth_user_id/g)].map(m => m.index);
  console.log('ocorrencias auth_user_id:', matches.length);
  for (const i of matches) console.log('...', d.substring(Math.max(0, i - 140), i + 180).replace(/\n/g, ' | '));
  console.log('--- ocorrências prestador uuid x auth (ownership) ---');
  const own = [...d.matchAll(/v_call_prestador|auth\.uid/g)].map(m => m.index);
  console.log('v_call_prestador/auth.uid:', own.length);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
