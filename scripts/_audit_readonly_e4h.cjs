const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // 1. trigger de OS status — valida transicao?
  const r = await c.query(`SELECT pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgname='trg_evento_os_status_changed'`);
  console.log('[trg_evento_os_status_changed]', r.rows[0].d);
  const fn = await c.query(`SELECT p.proname, pg_get_functiondef(p.oid) d FROM pg_proc p WHERE p.proname IN ('f_evento_os_status_changed','f_trg_evento_os_status_changed')`);
  for (const row of fn.rows) {
    const hasTrans = /TRANSICAO_INVALIDA|transicao_invalida|permitidas|STATUS_TRANSICOES/i.test(row.d);
    console.log('[fn]', row.proname, 'valida_transicao=' + hasTrans, 'len=' + row.d.length);
  }
  // 2. grants RPCs financeiras
  const g = await c.query(`
    SELECT p.proname, (aclexplode(p.proacl)).grantee::regrole::text AS grantee, (aclexplode(p.proacl)).privilege_type AS priv
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_registrar_baixa_financeira','f_aprovar_pagamento_prestadores','f_confirmar_pagamento_fechamento')
    ORDER BY p.proname`);
  for (const row of g.rows) console.log('[grant]', row.proname, '->', row.grantee, row.priv);
  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
