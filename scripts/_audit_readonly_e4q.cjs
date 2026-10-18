const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const fn of ['f_calcular_financeiro_operacao', 'f_registrar_notificacao_app', 'f_atualizar_reversa_app']) {
    const r = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname=$1`, [fn]);
    if (!r.rows.length) { console.log('[fn]', fn, 'AUSENTE'); continue; }
    const d = r.rows[0].d;
    const dml = ['INSERT INTO', 'UPDATE ', 'DELETE FROM'].filter(k => d.toUpperCase().includes(k));
    console.log('[fn]', fn, '| len=' + d.length, '| auth.uid=' + d.includes('auth.uid'), '| DML=' + (dml.join(',') || 'none'), '| RETURNS ' + (d.match(/RETURNS\s+([\w\s.]+)/i)?.[1] || '?'));
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
