const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT proname, pg_get_functiondef(oid) d FROM pg_proc WHERE proname IN ('f_trg_propagar_financeiro_os','f_trg_propagar_financeiro_alocacao')`);
  for (const row of r.rows) {
    fs.writeFileSync('scripts/_e4f_' + row.proname + '.sql', row.d, 'utf8');
    const m = [...row.d.matchAll(/v_outros_custos\s*:=\s*([^;]+);/g)].map(x => x[1].replace(/\s+/g, ' '));
    console.log(row.proname, 'outros_custos :=', JSON.stringify(m));
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
