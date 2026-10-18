// Check alocacoes_escala FK columns
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 10000 });
  await c.connect();

  // All columns of alocacoes_escala
  const r = await c.query(`SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema='public' AND table_name='alocacoes_escala' ORDER BY ordinal_position`);
  console.log('=== alocacoes_escala ALL columns ===');
  for (const row of r.rows) {
    console.log(`  ${row.ordinal_position}. ${row.column_name} (${row.data_type})`);
  }

  // Sample 3 rows to see relationship
  const s = await c.query(`SELECT id, cliente, prestador_id, cliente_id FROM public.alocacoes_escala LIMIT 3`);
  console.log('\n=== Sample alocacoes ===');
  for (const row of s.rows) {
    console.log(JSON.stringify(row));
  }

  await c.end();
})();
