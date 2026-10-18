// M133-D.7.2 — Diagnóstico de tipos das colunas
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();
  const tables = [
    'public.eventos_oficiais',
    'public.operation_timeline_events',
    'public.historico_alocacoes_escala',
    'public.financeiro_receber'
  ];
  for (const t of tables) {
    const r = await c.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`, [t.split('.')[1]]);
    console.log(`\n=== ${t} ===`);
    r.rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type} (${col.udt_name})`));
  }
  await c.end();
})();
