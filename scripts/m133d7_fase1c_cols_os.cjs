// Check exact text columns for ordens_servico and alocacoes_escala
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // ordens_servico — first 20 text columns and their sample values
  const r1 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ordens_servico' AND data_type IN ('text','character varying','character') ORDER BY ordinal_position`);
  console.log('=== ordens_servico TEXT cols ===');
  for (const row of r1.rows) {
    const sample = await c.query(`SELECT LEFT(COALESCE(${row.column_name}::text,''),80) AS v FROM public.ordens_servico WHERE ${row.column_name} IS NOT NULL AND ${row.column_name} != '' LIMIT 1`);
    const val = sample.rows[0]?.v || '(NULL)';
    console.log(`  ${row.column_name} (${row.data_type}): "${val}"`);
  }

  // alocacoes_escala — first 20 text
  const r2 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='alocacoes_escala' AND data_type IN ('text','character varying','character') ORDER BY ordinal_position`);
  console.log('\n=== alocacoes_escala TEXT cols (first 20) ===');
  let count = 0;
  for (const row of r2.rows) {
    if (count++ >= 20) break;
    const sample = await c.query(`SELECT LEFT(COALESCE(${row.column_name}::text,''),80) AS v FROM public.alocacoes_escala WHERE ${row.column_name} IS NOT NULL AND ${row.column_name} != '' LIMIT 1`);
    const val = sample.rows[0]?.v || '(NULL)';
    console.log(`  ${row.column_name} (${row.data_type}): "${val}"`);
  }

  await c.end();
})();
