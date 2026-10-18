const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT conname, convalidated, pg_get_constraintdef(oid) def FROM pg_constraint WHERE contype='c' AND conname='ck_fp_status'`);
  console.log('ck_fp_status:', JSON.stringify(r.rows[0]));
  const r2 = await c.query(`SELECT status, count(*) n FROM financeiro_pagar GROUP BY status ORDER BY n DESC`);
  console.log('status dist:', r2.rows.map(x => `${x.status}=${x.n}`).join(', '));
  // rows que a UI mapStatusPagar converte para a_vencer mas transitions nao reconhece
  const r3 = await c.query(`SELECT count(*) n FROM financeiro_pagar WHERE status NOT IN ('aberto','pago','parcial','cancelado','a vencer','a_vencer','vencida','provisao','paga','cancelada')`);
  console.log('status FORA de STATUS_TRANSITIONS:', r3.rows[0].n);
  const r4 = await c.query(`SELECT count(*) n FROM financeiro_pagar WHERE status IN ('pendente')`);
  console.log("rows status='pendente' (sem chave em STATUS_TRANSITIONS):", r4.rows[0].n);
  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
