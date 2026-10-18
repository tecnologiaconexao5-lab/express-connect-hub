const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname='ck_fp_status'`);
  console.log('ck_fp_status:', r.rows[0]?.d);
  // linhas pendente: quando criadas? (trigger vs manual) — metadata/origem via os_id
  const r2 = await c.query(`SELECT count(*) FILTER (WHERE os_id IS NOT NULL) com_os, count(*) FILTER (WHERE os_id IS NULL) sem_os FROM financeiro_pagar WHERE status='pendente'`);
  console.log('pendente: com_os=' + r2.rows[0].com_os + ' sem_os=' + r2.rows[0].sem_os);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
