const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    SELECT conrelid::regclass::text tabela, conname, pg_get_constraintdef(oid) def
    FROM pg_constraint
    WHERE contype='c' AND conrelid::regclass::text IN ('ordens_servico','alocacoes_escala')`);
  console.log('CHECKs em OS/Escala:', r.rows.length ? '' : 'NENHUM');
  for (const row of r.rows) console.log(' ', row.tabela, row.conname, '=>', row.def.substring(0, 300));
  // existe trigger BEFORE que rejeite transicao invalida em alocacoes?
  const t = await client_t(c);
  console.log('triggers BEFORE em alocacoes/OS:', t);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
async function client_t(c) {
  const r = await c.query(`SELECT t.tgname, t.tgtype, c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relname IN ('ordens_servico','alocacoes_escala') AND (t.tgtype & 2) = 2`);
  return r.rows.map(x => x.relname + ':' + x.tgname).join(', ') || 'NENHUM';
}
