const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260902_rec061_bridge_prestador_recrutamento.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('=== PRE-FLIGHT ===');
  const funcBefore = await c.query(`SELECT routine_name FROM information_schema.routines WHERE routine_name = 'f_bridge_prestador_para_recrutamento'`);
  console.log('Function exists before:', funcBefore.rows.length > 0);
  const trigBefore = await c.query(`SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'`);
  console.log('Trigger exists before:', trigBefore.rows.length > 0);

  console.log('\n=== APPLYING ===');
  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('Migration applied OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAILED:', e.message);
    process.exit(1);
  }

  console.log('\n=== POST-FLIGHT ===');
  const funcAfter = await c.query(`SELECT security_type FROM information_schema.routines WHERE routine_name = 'f_bridge_prestador_para_recrutamento'`);
  console.log('Function:', funcAfter.rows.length > 0 ? 'OK (' + funcAfter.rows[0].security_type + ')' : 'MISSING');
  const trigAfter = await c.query(`SELECT trigger_name, event_manipulation, action_timing FROM information_schema.triggers WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'`);
  console.log('Trigger:', trigAfter.rows.length > 0 ? 'OK (' + trigAfter.rows[0].event_manipulation + ' ' + trigAfter.rows[0].action_timing + ')' : 'MISSING');

  await c.end();
  console.log('\n=== DONE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
