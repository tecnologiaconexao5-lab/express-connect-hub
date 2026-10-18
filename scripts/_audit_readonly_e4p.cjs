const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT c.relrowsecurity rls,
      (SELECT string_agg(policyname || ' [' || cmd || ' ' || coalesce(roles::text,'') || ']', '; ')
       FROM pg_policies p WHERE p.tablename='rede_oportunidades') pols
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='rede_oportunidades'`);
  console.log('[rls] rede_oportunidades:', JSON.stringify(r.rows[0]));
  const r2 = await c.query(`SELECT p.proname, p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('f_buscar_oportunidades_para_prestador','f_aceitar_oportunidade_rede','f_registrar_notificacao_app','f_calcular_financeiro_operacao','f_atualizar_status_parada','f_atualizar_reversa_app')`);
  for (const x of r2.rows) console.log('[grants]', x.proname, '=>', x.acl);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
