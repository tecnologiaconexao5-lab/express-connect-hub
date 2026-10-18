const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  const d = r.rows[0].d;
  console.log('SECURITY DEFINER:', /SECURITY DEFINER/.test(d));
  console.log('=== assinatura (ate AS $$) ===');
  console.log(d.substring(0, d.indexOf('AS $$') + 5));
  const i = d.indexOf('p_auth_user_id');
  console.log('=== bloco p_auth_user_id ===');
  console.log(d.substring(Math.max(0, i - 250), i + 700));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
