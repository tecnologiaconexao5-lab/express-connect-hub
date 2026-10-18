const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // Funções que tms032 (20260801000008) revogou de PUBLIC/anon — se ainda têm anon/PUBLIC, a migration não foi aplicada
  const g = await c.query(`
    SELECT p.proname, (aclexplode(p.proacl)).grantee::regrole::text AS grantee, (aclexplode(p.proacl)).privilege_type AS priv
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_atualizar_status_parada','f_atualizar_reversa_app','f_registrar_notificacao_app','f_calcular_financeiro_operacao')
    ORDER BY p.proname`);
  for (const row of g.rows) console.log('[tms032 target]', row.proname, '->', row.grantee, row.priv);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
