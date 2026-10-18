const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // 1. Privilégio EXPLÍCITO de anon/PUBLIC na função de aceite (assinação exata)
  const sig = `public.f_aceitar_oportunidade_rede(uuid,uuid,uuid)`;
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const r = await c.query(`SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE') AS ok`, [role, sig]);
    console.log(`[priv] ${role} EXECUTE f_aceitar = ${r.rows[0].ok}`);
  }
  const rPub = await c.query(`SELECT has_function_privilege('public', $1::regprocedure, 'EXECUTE') AS ok`, [sig]);
  console.log(`[priv] PUBLIC(implicit) ? n/a — grantee PUBLIC explicit check via aclexplode:`);
  const rAcl = await c.query(`SELECT (aclexplode(p.proacl)).grantee AS grantee_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  console.log('  grantee oids:', rAcl.rows.map(x => x.grantee_oid).join(','), '(0 = PUBLIC)');
  // 2. Body de f_atualizar_status_parada (tms032 S1) — tem auth.uid?
  const r1 = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_atualizar_status_parada'`);
  if (r1.rows.length) {
    const d = r1.rows[0].d;
    console.log('f_atualizar_status_parada len=' + d.length, 'auth.uid=' + d.includes('auth.uid'), 'AUTH_USER_ID_INVALIDO=' + d.includes('AUTH_USER_ID_INVALIDO'));
  }
  // 3. f_registrar_notificacao_app (tms032 S9)
  const r2 = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_registrar_notificacao_app'`);
  if (r2.rows.length) console.log('f_registrar_notificacao_app auth.uid=' + r2.rows[0].d.includes('auth.uid'));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
