const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // Check ALL columns of prestadores to find veiculos
  const allCols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'prestadores' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  const colNames = allCols.rows.map(r => r.column_name);
  console.log('=== ALL prestadores columns (' + colNames.length + ') ===');
  console.log(colNames.join(', '));

  // Check for veiculos column
  console.log('\nHas veiculos column:', colNames.includes('veiculos'));

  // Sample the app prestador to see its full row
  const app = await c.query(`SELECT * FROM public.prestadores WHERE origem = 'app_prestador' LIMIT 1`);
  if (app.rows.length > 0) {
    const row = app.rows[0];
    console.log('\n=== Sample app prestador (all fields) ===');
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== '' && v !== false) {
        console.log('  ' + k + ':', typeof v === 'object' ? JSON.stringify(v) : v);
      }
    }
  }

  // Check recrutamento_candidatos columns
  const rcCols = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'recrutamento_candidatos' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  console.log('\n=== recrutamento_candidatos columns (' + rcCols.rows.length + ') ===');
  rcCols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')' + (r.is_nullable === 'YES' ? ' NULL' : ' NOT NULL') + (r.column_default ? ' DEFAULT ' + r.column_default : '')));

  // Check a sample recrutamento_candidatos row
  const rc = await c.query(`SELECT * FROM public.recrutamento_candidatos WHERE prestador_id IS NOT NULL LIMIT 1`);
  if (rc.rows.length > 0) {
    const row = rc.rows[0];
    console.log('\n=== Sample recrutamento_candidatos with prestador_id ===');
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== '') {
        console.log('  ' + k + ':', typeof v === 'object' ? JSON.stringify(v) : v);
      }
    }
  }

  await c.end();
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
