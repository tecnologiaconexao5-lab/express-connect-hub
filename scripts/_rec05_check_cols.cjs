const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();
  const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='documentos_prestadores' AND table_schema='public' ORDER BY ordinal_position");
  console.log('=== documentos_prestadores columns ===');
  cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));
  await c.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
